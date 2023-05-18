/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as os from "os";
import * as fs from "fs";
import { resolve } from "path";
import * as vscode from "vscode";
import { ClickDest, ClickDestType, PNGData } from "./commands";

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
    public set pixel_per_pt(v: number) {
        this._pixel_per_pt = v;
    }
    public get pixel_per_pt(): number {
        return this._pixel_per_pt;
    }
    protected _pixel_per_pt = 1;
    constructor(public typ: vscode.Uri, public png_folder: vscode.Uri, public data: PNGData) {
    }
    update_page_config(): Promise<void> | void {
        return;
    }
    click(x: number, y: number,page:number): Promise<ClickDest|undefined>  | undefined{
        console.log(x, y,page);
        return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    async reload():Promise<void>{
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
                    // this._update();
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
                        const { page } = message;
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        this.handler.data.page = page;
                        await this.handler.update_page_config();
                        this.updateSrc();
                        return;
                    case "click":
                        const res=await this.handler.click(message.x, message.y,message.page);
                        if(res?.type===ClickDestType.Position){
                            this.scrollTo(res.page,res.x,res.y)
                        }
                        return;
                    case "px_per_pt":
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        this.handler.pixel_per_pt = parseFloat(message.value);
                        return;
                    case "reload":
                        await this.handler.reload();
                        for(let i=0;i<this.handler.data.total_page;i++){
                            this.handler.data.page = i;
                            await this.handler.update_page_config();
                        }
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
    public scrollTo(page:number,x:number,y:number):void{
        this._panel.webview.postMessage({
            command: "scroll",
            page,x,y,
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

        const pages:string[]=[]
        for (let i=0;i<this.handler.data.total_page;i++){
            let img=`content not sended for performance`;
            if(this.handler.data.page==i)
                img=`<img src="${uris.png}" alt=${nonce} style="height:${this.handler.data.height}pt;width:${this.handler.data.width}pt">`;
            pages.push(`
<div id="page_${i}" class="page_canvas" style="height:${this.handler.data.height}pt;width:${this.handler.data.width}pt">
${img}
</div>
<hr>`)
        }

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
                        <label for="scale">Scale</label>
                        <input id="scale" type="number" min="0.1" max="10" step="0.01" value="0">
                        <input id="window-width" type="button" value="▭">
                        <input id="window-height" type="button" value="▯">
                        <input id="reload" type="button" value="⟳">
                        <label for="px_per_pt">PxPerPt</label>
                        <input id="px_per_pt" type="number" min="0.1" max="10" step="0.01" value="${this.handler.pixel_per_pt}"> 
                    </div>
                    <div class="page_container">
                        ${pages.join("")}
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
