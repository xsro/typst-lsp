const vscode = acquireVsCodeApi();

// this value will insert by extension
// const META={"height":841.89105,"page":0,"total_page":2,"typ":"/Users/apple/repo/persue-master/doc/overview.typ","width":595.2764999999999,"src":{"$mid":1,"fsPath":"/var/folders/20/m3sv_7d56dj8_m_79qc3ypw00000gn/T/typst-lsp-vscode/overview/first.png","path":"/var/folders/20/m3sv_7d56dj8_m_79qc3ypw00000gn/T/typst-lsp-vscode/overview/first.png","scheme":"file"}}

const page_idx_ele = document.getElementById("page");
const scale_ele = document.getElementById("scale");
const page_ele = document.getElementById("page_canvas");
const window_height_ele = document.getElementById("window-height");
const window_width_ele = document.getElementById("window-width");
const px_per_pt_ele = document.getElementById("px_per_pt");

/**send request to host for page*/
function reload() {
    const page = parseInt(page_idx_ele.value);
    const px_per_pt = parseFloat(px_per_pt_ele.value);
    vscode.postMessage({
        command: "page",
        page: page - 1,
        px_per_pt,
    });
}

page_idx_ele.addEventListener("input", reload);
px_per_pt_ele.addEventListener("input", reload);
document.getElementById("reload").addEventListener("click", reload);

function resize(scale = undefined) {
    const s = vscode.getState() || { scale: "window width" };
    vscode.setState({ ...s });
    let step = parseFloat(scale_ele.step);
    if (scale === undefined) {
        scale = s.scale;
        scale_ele.value = scale;
    }
    if (scale == "window width") {
        scale = Math.floor(window.innerWidth / META.width / step) * step;
        scale_ele.value = scale;
    }
    if (scale == "window height") {
        scale = Math.floor(window.innerHeight / META.height / step) * step;
        scale_ele.value = scale;
    }
    page_ele.style.width = META.width * scale + "px";
    page_ele.style.height = META.height * scale + "px";
}

window_height_ele.addEventListener("click", () => resize("window height"));
window_width_ele.addEventListener("click", () => resize("window width"));
scale_ele.addEventListener("input", () => {
    resize(parseFloat(scale_ele.value));
});

function jumpSource(event) {
    const x = event.offsetX / event.target.width;
    const y = event.offsetY / event.target.height;
    vscode.postMessage({
        command: "click",
        x,
        y,
    });
}
page_ele.addEventListener("click", jumpSource);
page_ele.parentElement.addEventListener("scroll", (e) => {
    setTimeout(() => {
        vscode.setState({
            ...vscode.getState(),
            scrollLeft: e.target.scrollLeft,
            scrollTop: e.target.scrollTop,
        });
    }, 100);
});
const state = vscode.getState();
if (state && state.scrollTop && state.scrollLeft)
    page_ele.parentElement.scrollTo({
        top: state.scrollTop,
        left: state.scrollLeft,
        behavior: "smooth",
    });

// Handle messages sent from the extension to the webview
window.addEventListener("message", async (event) => {
    const message = event.data; // The json data that the extension sent
    console.log(message.command);
    switch (message.command) {
        case "load":
            page_ele.src = message.src;
            META = message.data;
            break;
    }
});

resize();
