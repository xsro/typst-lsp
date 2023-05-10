/* eslint-disable */
import { Uri, window } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

export interface PNGData {
    src: Uri;
    height: number;
    width: number;
    /**0-index page num */
    page: number;
    total_page: number;
    typ: string;
}

export interface ClickDest {
    path: string | null;
    "byte offset": number | null;
}

export class ClientCommand {
    constructor(public client: () => LanguageClient) {}
    async requestToClient(command: string, ...params: unknown[]): Promise<unknown> {
        return await this.client()
            .sendRequest("workspace/executeCommand", {
                command,
                arguments: params,
            })
            .catch((e) => {
                window.showErrorMessage((e as any).message);
            });
    }
    async exportPng(src: Uri, dst: Uri, page = 0, pixel_per_pt = 2): Promise<PNGData> {
        const val = await this.requestToClient(
            "typst-lsp.doPngExport",
            src.toString(),
            dst.fsPath,
            page,
            pixel_per_pt,
            0
        );
        if (!val) {
            throw new Error("export failed");
        }
        (val as any).src = dst;
        return val as PNGData;
    }
    async jumpFromClick(
        typ: Uri,
        page: number,
        x: number,
        y: number
    ): Promise<ClickDest | undefined> {
        const res = await this.requestToClient(
            "typst-lsp.jumpFromClick",
            typ.toString(),
            page,
            x,
            y
        );
        return res as ClickDest;
    }
}
