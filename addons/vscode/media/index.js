const vscode = acquireVsCodeApi();

const eles={
    background:document.getElementById("background"),
    window_height:document.getElementById("window-height"),
    window_width:document.getElementById("window-width"),
}
const scale_ele = document.getElementById("scale");
const page_container = document.getElementsByClassName("page_container")[0];
const page_eles = page_container.childNodes;

const oldSize = {}
function resize(scale = undefined) {
    for (let i = 0; i < page_eles.length; i++) {
        const ele=page_eles[i];
        if (oldSize[i] == undefined) {
            oldSize[i] = { width: ele.clientWidth, height: ele.clientHeight }
        }
        const s = vscode.getState() || { scale: "window width" };
        let step = parseFloat(scale_ele.step);
        if (scale === undefined) {
            scale = s.scale;
        }
        vscode.setState({ ...s, scale });
        if (scale == "window width" ) {
            scale = Math.floor(window.innerWidth / oldSize[i].width / step) * step;
        }
        if (scale == "window height") {
            scale = Math.floor(window.innerHeight / oldSize[i].height / step) * step;
        }
        scale_ele.value = scale;
        
        ele.style.width = oldSize[i].width * scale + "px";
        ele.style.height = oldSize[i].height * scale + "px";
        let img_ele=ele;
        
        img_ele.style.width = oldSize[i].width * scale + "px";
        img_ele.style.height = oldSize[i].height * scale + "px";
    }
}
scale_ele.addEventListener("input", ()=>resize(parseFloat(scale_ele.value)))
eles.window_height.addEventListener("click", () => resize("window height"));
eles.window_width.addEventListener("click", () => resize("window width"));


function setBackground(color){
    for (let idx=0;idx<page_container.childNodes.length;idx++){
        page_container.childNodes[idx].style.background=color
    }
}
eles.background.addEventListener("input",()=>{
    setBackground(eles.background.value)
    vscode.postMessage({
        cmd:"config",
        key:"background",
        value:eles.background.value
    })
})


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
        behavior: "instant",
    });

window.addEventListener("message", async (event) => {
    const message = event.data; // The json data that the extension sent
    console.log(message);
    switch (message.cmd) {
        case "load":
            for (let idx=0;idx<message.pages.length;idx++){
                function assign_img(i){
                    i.src=message.pages[idx].src;
                    i.width=message.pages[idx].width;
                    i.height=message.pages[idx].height;
                    i.style.background=eles.background.value;
                }
                if(page_container.childNodes.length>idx){
                    assign_img(page_container.childNodes[idx])
                }else{
                    const i=document.createElement("img");
                    assign_img(i)
                    page_container.appendChild(i)
                }
            }
            resize();
            break;
        case "config":
            setBackground(message.background)
            eles.background.value=message.background
            break
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