const vscode = acquireVsCodeApi();

const scale_ele = document.getElementById("scale");
const page_eles = document.getElementsByClassName("page_canvas");
const page_container = document.getElementsByClassName("page_container")[0];
const window_height_ele = document.getElementById("window-height");
const window_width_ele = document.getElementById("window-width");

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
                if(page_container.childNodes.length>idx){
                    page_container.childNodes[idx].src=message.pages[idx]
                }else{
                    const i=document.createElement("img");
                    i.src=message.pages[idx];
                    page_container.appendChild(i)
                }
            }
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