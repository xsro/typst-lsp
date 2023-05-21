
use std::fs::OpenOptions;
use std::path::PathBuf;
use std::io::prelude::*;
use std::env::temp_dir;
use typst::doc::Document;
use typst::geom::{Color,RgbaColor};
use tower_lsp::{
    jsonrpc::{Error, Result},
};

use crate::workspace::source::Source;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct F32withEq(f32);
impl Eq for F32withEq{}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportPngConfig{
    pub fill:Color,
    pub pixel_per_pt:F32withEq,
}

impl Default for ExportPngConfig{
    fn default() -> Self {
        Self{
            fill:Color::Rgba(RgbaColor { r: 0, g: 0, b: 0, a: 0 }),
            pixel_per_pt:F32withEq(1.0),
        }
    }
}

pub fn export_png(src:&Source,document: &Document,conf:&ExportPngConfig) -> Result<PathBuf> {
    let tmpdir=temp_dir().join("typst-lsp");
    let sep=src.as_ref().id().into_u16().to_string();
    
    let mut file = OpenOptions::new().append(true).open(tmpdir.join("info.txt")).map_err(|e|{
        Error{
            code:tower_lsp::jsonrpc::ErrorCode::ServerError(4),
            message: e.to_string(),
            data: None,
        }
    })?;
    let message=format!("{}\t{}\t{}\r\n",sep,document.pages.len().to_string(),src.as_ref().path().to_string_lossy());
    file.write(message.as_bytes()).map_err(|e|{
        Error{
            code:tower_lsp::jsonrpc::ErrorCode::ServerError(4),
            message: e.to_string(),
            data: None,
        }
    })?;
    let dest=tmpdir.join(sep);
    std::fs::create_dir_all(dest.clone()).map_err(|e|{
        Error{
            code:tower_lsp::jsonrpc::ErrorCode::ServerError(4),
            message: e.to_string(),
            data: None,
        }
    })?;
    for page_index in 0..document.pages.len(){
        let frame=&document.pages[page_index];
        let data=typst::export::render(frame, conf.pixel_per_pt.0, conf.fill);
        data.save_png(dest.join(format!("{}.png",page_index))).map_err(|e|{
            Error{
                code:tower_lsp::jsonrpc::ErrorCode::ServerError(4),
                message: e.to_string(),
                data: None,
            }
        })?;
    
        let width=document.pages[page_index].width();// in pt
        let height=document.pages[page_index].height();// in pt
    }
    
    Ok(dest)
}

