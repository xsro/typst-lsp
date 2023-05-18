const vscode = acquireVsCodeApi();

// this value will insert by extension
// const META={"height":841.89105,"page":0,"total_page":2,"typ":"/Users/apple/repo/persue-master/doc/overview.typ","width":595.2764999999999,"src":{"$mid":1,"fsPath":"/var/folders/20/m3sv_7d56dj8_m_79qc3ypw00000gn/T/typst-lsp-vscode/overview/first.png","path":"/var/folders/20/m3sv_7d56dj8_m_79qc3ypw00000gn/T/typst-lsp-vscode/overview/first.png","scheme":"file"}}

const scale_ele = document.getElementById("scale");
const page_eles = document.getElementsByClassName("page_canvas");
const page_container = document.getElementsByClassName("page_container")[0];
const window_height_ele = document.getElementById("window-height");
const window_width_ele = document.getElementById("window-width");
const px_per_pt_ele = document.getElementById("px_per_pt");

const visible_pages = {};
const page_meta = {}

/**send request to host for page*/
function load(page) {
    const px_per_pt = parseFloat(px_per_pt_ele.value);
    vscode.postMessage({
        command: "page",
        page: page,
        px_per_pt,
    });
}

px_per_pt_ele.addEventListener("input",function (e){
    const pxPerPt=e.target.value;
    vscode.postMessage({
        command: "px_per_pt",
        value:pxPerPt,
    });
})


const oldSize = {}
function resize(scale = undefined) {
    for (let i = 0; i < page_eles.length; i++) {
        const ele=page_eles[i];
        if (oldSize[ele.id] == undefined) {
            oldSize[ele.id] = { width: ele.clientWidth, height: ele.clientHeight }
        }
        const s = vscode.getState() || { scale: "window width" };
        let step = parseFloat(scale_ele.step);
        if (scale === undefined) {
            scale = s.scale;
        }
        vscode.setState({ ...s, scale });
        if (scale == "window width") {
            scale = Math.floor(window.innerWidth / oldSize[ele.id].width / step) * step;
        }
        if (scale == "window height") {
            scale = Math.floor(window.innerHeight / oldSize[ele.id].height / step) * step;
        }
        scale_ele.value = scale;
        
        ele.style.width = oldSize[ele.id].width * scale + "px";
        ele.style.height = oldSize[ele.id].height * scale + "px";
        let img_ele=null;
        ele.childNodes.forEach(val=>{
            if(val.tagName==="IMG") img_ele=val;
        })
        if(img_ele){
            img_ele.style.width = oldSize[ele.id].width * scale + "px";
            img_ele.style.height = oldSize[ele.id].height * scale + "px";
        }
    }
}
scale_ele.addEventListener("input", ()=>resize(parseFloat(scale_ele.value)))
window_height_ele.addEventListener("click", () => resize("window height"));
window_width_ele.addEventListener("click", () => resize("window width"));
resize();



function jumpSource(event) {
    const page = parseInt(event.target.parentElement.id.replace("page_", ""))
    const x = event.offsetX / event.target.width;
    const y = event.offsetY / event.target.height;
    vscode.postMessage({
        command: "click",
        x,
        y,
        page,
    });
}

page_container.addEventListener("scroll", (e) => {
    setTimeout(() => {
        vscode.setState({
            ...vscode.getState(),
            scrollLeft: e.target.scrollLeft,
            scrollTop: e.target.scrollTop,
        });
    }, 100);
});
const state = vscode.getState();
if (state && typeof state.scrollTop=="number" && typeof state.scrollLeft=="number")
    page_container.scrollTo({
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
            for (let i = 0; i < page_eles.length; i++) {
                if (page_eles[i].id === "page_" + message.data.page)
                    page_eles[i].innerHTML = `<img src="${message.src}" style="height:${message.data.height}pt;width:${message.data.width}pt">`;
            }
            META = message.data;
            break;
        case "scroll":
            let heights=0;
            for(let i=0;i<message.page-1;i++){
                heights+=page_eles[i].clientHeight;
            }
            page_container.scrollTo({
                top: heights+message.y*page_eles[message.page-1].clientHeight,
                left: message.x*page_eles[message.page-1].clientWidth,
                behavior: "smooth",
            });
            break
    }
});




var observer = new IntersectionObserver(function (entries) {
    const id = entries[0].target.id
    if (id.startsWith("page_")) {
        const page = parseInt(id.replace("page_", ""))
        visible_pages[page] = entries[0].isIntersecting
        if (entries[0].isIntersecting === true) {
            load(page)
        }
    }
    console.log(visible_pages)
}, { threshold: [0] });


for (let i = 0; i < page_eles.length; i++) {
    observer.observe(page_eles[i]);
    console.log(page_eles[i].id)
    page_eles[i].addEventListener("click", (event)=>{
        if(event.target.tagName==="DIV"){
            const id = event.target.id
            const page = parseInt(id.replace("page_", ""))
            if (entries[0].isIntersecting === true) {
                load(page)
            }
        }else{
            jumpSource(event)
        } 
    });
}
