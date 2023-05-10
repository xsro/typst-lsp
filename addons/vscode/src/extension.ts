import {
    type ExtensionContext,
    workspace,
    window,
    commands,
    Uri,
    WorkspaceConfiguration,
} from "vscode";
import * as path from "path";
import * as fs from "fs";

import {
    LanguageClient,
    DidChangeConfigurationNotification,
    type LanguageClientOptions,
    type ServerOptions,
} from "vscode-languageclient/node";
import { PdfPreviewPanel, tempfile, PreviewHandler } from "./viewer";
import { ClientCommand } from "./commands";
import { Selection } from "vscode";
import { ViewColumn } from "vscode";

let client: LanguageClient | undefined = undefined;
const cmd = new ClientCommand(() => {
    if (client === undefined) throw new Error("client not ready");
    else return client;
});

export function activate(context: ExtensionContext): Promise<void> {
    const config = workspace.getConfiguration("typst-lsp");
    const serverCommand = getServer(config);
    const serverOptions: ServerOptions = {
        run: { command: serverCommand, options: { env: { RUST_BACKTRACE: "1" } } },
        debug: { command: serverCommand, options: { env: { RUST_BACKTRACE: "1" } } },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: "file", language: "typst" }],
    };

    client = new LanguageClient("typst-lsp", "Typst Language Server", serverOptions, clientOptions);

    workspace.onDidChangeConfiguration(async (_) => {
        await client?.sendNotification(DidChangeConfigurationNotification.type, {
            settings: workspace.getConfiguration("typst-lsp"),
        });
    }, null);

    context.subscriptions.push(
        commands.registerCommand("typst-lsp.exportCurrentPdf", commandExportCurrentPdf)
    );
    context.subscriptions.push(
        commands.registerCommand("typst-lsp.showPdf", () => commandShowPdf(context))
    );

    return client.start();
}

export function deactivate(): Promise<void> | undefined {
    return client?.stop();
}

function getServer(conf: WorkspaceConfiguration): string {
    const pathInConfig = conf.get<string | null>("serverPath");
    if (pathInConfig !== undefined && pathInConfig !== null && fileExists(pathInConfig)) {
        return pathInConfig;
    }
    const windows = process.platform === "win32";
    const suffix = windows ? ".exe" : "";
    const binaryName = "typst-lsp" + suffix;

    const bundledPath = path.resolve(__dirname, binaryName);

    if (fileExists(bundledPath)) {
        return bundledPath;
    }

    return binaryName;
}

function fileExists(path: string): boolean {
    try {
        fs.accessSync(path);
        return true;
    } catch (error) {
        return false;
    }
}

async function commandExportCurrentPdf(): Promise<void> {
    const activeEditor = window.activeTextEditor;
    if (activeEditor === undefined) {
        return;
    }

    const uri = activeEditor.document.uri.toString();

    await client?.sendRequest("workspace/executeCommand", {
        command: "typst-lsp.doPdfExport",
        arguments: [uri],
    });
}

class Handler extends PreviewHandler {
    png_idx = 0;
    async update_page_config(): Promise<void> {
        this.png_idx = (this.png_idx + 1) % 100;
        const png = Uri.joinPath(
            this.png_folder,
            this.data.page.toString() + "_" + this.png_idx.toString() + ".png"
        );
        const res = await cmd.exportPng(this.typ, png, this.data.page, this.pixel_per_pt);
        this.data = res;
    }
    async click(x: number, y: number): Promise<void> {
        const res = await cmd.jumpFromClick(this.typ, this.data.page, x, y);
        if (res?.path != null) {
            let viewColumn = ViewColumn.One;
            window.visibleTextEditors.forEach((e) => {
                if (e.document.uri.fsPath === res.path && e.viewColumn !== undefined) {
                    viewColumn = e.viewColumn;
                }
            });
            const doc = await workspace.openTextDocument(res.path);
            if (res["byte offset"] != null) {
                const buffer = Buffer.from(doc.getText());
                const s = buffer.subarray(0, res["byte offset"]).toString();
                const pos = doc.positionAt(s.length);
                const range = doc.getWordRangeAtPosition(pos);
                if (range !== undefined) {
                    const selection = new Selection(range.start, range.end);
                    await window.showTextDocument(Uri.file(res.path), { selection, viewColumn });
                }
            }
        }
        return;
    }
}

/**
 * Implements the functionality for the 'Show PDF' button shown in the editor title
 * if a `.typ` file is opened.
 *
 */
async function commandShowPdf(ctx: ExtensionContext): Promise<void> {
    const activeEditor = window.activeTextEditor;
    if (activeEditor === undefined) {
        return;
    }

    const uri = activeEditor.document.uri;

    const png_dir_folder = tempfile(path.basename(uri.fsPath, ".typ"), true);
    const png_dir = Uri.file(png_dir_folder);
    const png = Uri.joinPath(png_dir, "first.png");

    const data = await cmd.exportPng(uri, png, 0, 1).catch(async (e) => {
        await window.showErrorMessage(`compile ${uri.fsPath} failed`, JSON.stringify(e));
    });
    if (typeof data !== "object") return;
    const h = new Handler(uri, png_dir, data);
    PdfPreviewPanel.createOrShow(ctx.extensionUri, h);
    let last_run = 0;
    workspace.onDidChangeTextDocument(async (e) => {
        if (!e.document.uri.path.endsWith(".typ")) return;
        if (Date.now() - last_run < 1000) return;
        await h.update_page_config();
        PdfPreviewPanel.currentPanel?.updateSrc();
        last_run = Date.now();
    });
}
