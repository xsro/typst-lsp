/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as os from "os";
import * as fs from "fs";
import { basename, resolve } from "path";
import * as vscode from "vscode";
import { getLastLine } from "./preview-util";

function findInfo(info: string, src: string): { pages: number, id: string } | undefined {
    const lines = info.split("\r\n");
    for (const line of lines) {
        const [id, pages, source] = line.split("\t");
        if (source === src) {
            return { pages: Number(pages), id };
        }
    }
    return;
}

const tempdir = resolve(os.tmpdir(), "typst-lsp");
const info_path = resolve(tempdir, "info.txt");

async function load_pages(webview: vscode.Webview, uri: vscode.Uri,  onlyLastLine = false): Promise<void> {
    let info = "";
    if (onlyLastLine) {
        info = await getLastLine(info_path, 3)
    } else {
        info = await fs.promises.readFile(info_path, "utf-8");
    }
    const src = findInfo(info, uri.fsPath);
    if (src === undefined) return;
    const date = Date.now()
    const pages = Array.from({ length: src.pages }, (_, i) => {
        const p = resolve(tempdir, src.id, i.toString() + ".png");
        const web = webview.asWebviewUri(vscode.Uri.file(p));
        const dyn = vscode.Uri.from({ ...web, query: "up=" + date.toString() })
        return dyn.toString()
    });
    webview.postMessage({ cmd: "load", pages })
}

export function getHtml(webview: vscode.Webview, media: vscode.Uri): string {
    const load = (seg: string): string => webview.asWebviewUri(vscode.Uri.joinPath(media, seg)).toString();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${load("index.css")}" rel="stylesheet">
</head>
<body>
    <div class="container">
        <div class="control">
            <label for="scale">Scale</label>
            <input id="scale" type="number" min="0.1" max="10" step="0.01" value="0">
            <input id="window-width" type="button" value="▭">
            <input id="window-height" type="button" value="▯">
        </div>
        <div class="page_container"></div>
    </div>
    <script src="${load("index.js")}"></script>
</body>
</html>`
}

export function showTypst(uri: vscode.Uri, ctx: vscode.ExtensionContext): vscode.WebviewPanel {
    const tempuri = vscode.Uri.file(tempdir);

    const media = vscode.Uri.joinPath(ctx.extensionUri, "media");
    const panel = vscode.window.createWebviewPanel("typst-preview", basename(uri.fsPath), vscode.ViewColumn.Beside, {
        enableScripts: true,
        localResourceRoots: [tempuri, media]
    });

    const watcher = fs.watch(resolve(tempdir, "info.txt"));
    panel.webview.html=getHtml(panel.webview,media)
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    watcher.on("change", () => load_pages(panel.webview,uri,true))
    load_pages(panel.webview,uri,false)
    return panel
}


export function activate(context: vscode.ExtensionContext): void {
    fs.writeFileSync(info_path,"")
    context.subscriptions.push(vscode.commands.registerCommand("typst-lsp.showPdf", (uri:vscode.Uri)=>showTypst(uri,context)));
}
