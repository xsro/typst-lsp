/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as os from "os";
import * as fs from "fs";
import { resolve } from "path";
import * as vscode from "vscode";

export interface PNGData {
    src: vscode.Uri;
    height: number;
    width: number;
    /**0-index page num */
    page: number;
    total_page: number;
    typ: string;
}

const tempdir = resolve(os.tmpdir(), "typst-lsp-vscode");
export function tempfile(basename: string, dir = false): string {
    if (!fs.existsSync(tempdir)) fs.mkdirSync(tempdir);
    const r = resolve(tempdir, basename);
    if (dir) {
        if (!fs.existsSync(r)) fs.mkdirSync(r);
    }
    return r;
}

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
    return {
        // Enable javascript in the webview
        enableScripts: true,

        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media"), vscode.Uri.file(tempdir)],
    };
}

export class PreviewHandler {
    pixel_per_pt = 3;
    constructor(public typ: vscode.Uri, public png_folder: vscode.Uri, public data: PNGData) {
        console.log(png_folder);
    }
    update_page_config(): Promise<void> | void {
        return;
    }
}

/**
 * Manages cat coding webview panels
 */
export class PdfPreviewPanel {
    /**
     * Track the currently panel. Only allow a single panel to exist at a time.
     */
    public static currentPanel: PdfPreviewPanel | undefined;

    public static readonly viewType = "typst_pdf_preview";

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, handler: PreviewHandler): void {
        // If we already have a panel, show it.
        if (PdfPreviewPanel.currentPanel !== undefined) {
            PdfPreviewPanel.currentPanel.handler = handler;
            // PdfPreviewPanel.currentPanel.updateSrc();
            PdfPreviewPanel.currentPanel._panel.reveal();
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            PdfPreviewPanel.viewType,
            "Typst preview",
            vscode.ViewColumn.Beside,
            getWebviewOptions(extensionUri)
        );

        PdfPreviewPanel.currentPanel = new PdfPreviewPanel(panel, extensionUri, handler);
    }

    // public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): void {
    //     PdfPreviewPanel.currentPanel = new PdfPreviewPanel(panel, extensionUri);
    // }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        public handler: PreviewHandler
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
        this._panel.onDidChangeViewState(
            (_e) => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case "page":
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        const { page, px_per_pt } = message;
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        this.handler.data.page = page;
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        this.handler.pixel_per_pt = px_per_pt;
                        await this.handler.update_page_config();
                        this.updateSrc();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public updateSrc(): void {
        this._panel.webview.postMessage({
            command: "load",
            data: this.handler.data,
            src: this._panel.webview.asWebviewUri(this.handler.data.src).toString(),
        });
    }

    public dispose(): void {
        PdfPreviewPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length > 0) {
            const x = this._disposables.pop();
            if (x !== undefined) {
                x.dispose();
            }
        }
    }

    private _update(): void {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, "media", "index.js");

        // Local path to css styles
        const stylesPathVscPath = vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css");
        const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, "media", "index.css");

        // Uri to load styles into webview
        const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);
        const stylesVscUri = webview.asWebviewUri(stylesPathVscPath);

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        const uris = {
            main: webview.asWebviewUri(scriptPathOnDisk).toString(),
            png: webview.asWebviewUri(this.handler.data.src).toString(),
        };

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${stylesVscUri.toString()}" rel="stylesheet">
				<link href="${stylesMainUri.toString()}" rel="stylesheet">
				<title>${this.handler.typ.fsPath}</title>
			</head>
			<body>
                <div class="container">
                    <div class="control">
                        <label for="page">Page</label>
                        <input id="page" type="number" min="1" value="${
                            this.handler.data.page + 1
                        }">
                        <label for="scale">Scale</label>
                        <input id="scale" type="number" min="0.1" max="10" step="0.01" value="0">
                        <input id="reload" type="button" value="⟲">
                        <input id="window-width" type="button" value="▭">
                        <input id="window-height" type="button" value="▯">
                        <input id="typst-src" type="text" readonly=true spellcheck=false value="${
                            this.handler.typ.path.substring(this.handler.typ.path.lastIndexOf("/")+1)
                        }">
                        <label for="px_per_pt">PxPerPt</label>
                        <input id="px_per_pt" type="number" min="0.1" max="10" step="0.01" value="1"> 
                    </div>
                    <div class="page_container">
                    <img id="page_canvas" src="${uris.png}" alt="${nonce}">
                    </div>
                </div>
                <script>var META=${JSON.stringify(this.handler.data)}</script>
				<script src="${uris.main}"></script>
			</body>
			</html>`;
    }
}

function getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
