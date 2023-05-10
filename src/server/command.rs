use std::path::PathBuf;

use serde_json::{Value, json};
use tower_lsp::{
    jsonrpc::{Error, Result},
    lsp_types::{Url},
};

use super::TypstServer;
use typst;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LspCommand {
    ExportPdf,
    ExportPng,
}

impl From<LspCommand> for String {
    fn from(command: LspCommand) -> Self {
        match command {
            LspCommand::ExportPdf => "typst-lsp.doPdfExport".to_string(),
            LspCommand::ExportPng => "typst-lsp.doPngExport".to_string(),
        }
    }
}

impl LspCommand {
    pub fn parse(command: &str) -> Option<Self> {
        match command {
            "typst-lsp.doPdfExport" => Some(Self::ExportPdf),
            "typst-lsp.doPngExport" => Some(Self::ExportPng),
            _ => None,
        }
    }

    pub fn all_as_string() -> Vec<String> {
        vec![Self::ExportPdf.into(),Self::ExportPng.into()]
    }
}

/// Here are implemented the handlers for each command.
impl TypstServer {
    /// Export the current document as a PDF file. The client is responsible for passing the correct file URI.
    pub async fn command_export_pdf(&self, arguments: Vec<Value>) -> Result<()> {
        if arguments.is_empty() {
            return Err(Error::invalid_params("Missing file URI argument"));
        }
        let Some(file_uri) = arguments.first().and_then(|v| v.as_str()) else {
            return Err(Error::invalid_params(
                "Missing file URI as first argument",
            ));
        };
        let file_uri = Url::parse(file_uri)
            .map_err(|_| Error::invalid_params("Parameter is not a valid URI"))?;

        let (world, source_id) = self.get_world_with_main_uri(&file_uri).await;
        let workspace = world.get_workspace();
        let source = workspace.sources.get_open_source_by_id(source_id);

        self.run_export(&world, source).await;

        Ok(())
    }

    pub async fn command_export_png(&self, arguments: Vec<Value>) -> Result<Option<Value>> {
        
        if arguments.is_empty() {
            return Err(Error::invalid_params("Missing file URI argument"));
        }

        //the document uri to compile
        let Some(file_uri) = arguments.first().and_then(|v| v.as_str()) 
        else {
            return Err(Error::invalid_params(
                "Missing file URI as first argument",
            ));
        };
        //the destination uri to write
        let file_uri = Url::parse(file_uri)
        .map_err(|_| Error::invalid_params("Parameter is not a valid URI"))?;
        let Some(file_out_uri) = arguments.get(1).and_then(|v| v.as_str()) else {
            return Err(Error::invalid_params(
                "Missing file out URI as second argument",
            ));
        };
        //the page idx
        let Some(page) = arguments.get(2).and_then(|v| v.as_u64()) else {
            return Err(Error::invalid_params(
                "Missing page as third argument",
            ));
        };
        //the pixel per pt
        let Some(pixel_per_pt) = arguments.get(3).and_then(|v| v.as_f64()) else {
            return Err(Error::invalid_params(
                "Missing pixel_per_pt as fourth argument",
            ));
        };
        //the background
        let Some(background) = arguments.get(4).and_then(|v| v.as_u64()) else {
            return Err(Error::invalid_params(
                "Missing background as fifth argument",
            ));
        };

        let page_destination=PathBuf::from(file_out_uri);
        let page_index:usize=page.try_into().unwrap();
        let pixel_per_pt=pixel_per_pt as f32;
        let r=background/0x100000000;
        let b=background/0x1000000;
        let g=background/0x10000;
        let a=background/0x100;
        let rgb=typst::geom::RgbaColor::new(r as u8, g as u8, b as u8, a as u8);

        let (world, source_id) = self.get_world_with_main_uri(&file_uri).await;
        let workspace = world.get_workspace();
        let source = workspace.sources.get_open_source_by_id(source_id);
        let diagnostics;
        let mut val=Value::Null;
        {
            let result=self.compile_source(&world);
            let document=result.0;
            diagnostics=result.1;
            if let Some(document) = document {
                if document.pages.len()<= page_index{
                    return Err(Error::invalid_params(
                        "Page out of range",
                    ));
                };
                let frame=&document.pages[page_index];
                
                let fill=typst::geom::Color::Rgba(rgb);
                let data=typst::export::render(frame, pixel_per_pt, fill);
                data.save_png(page_destination).map_err(|e|{
                    Error{
                        code:tower_lsp::jsonrpc::ErrorCode::ServerError(4),
                        message: e.to_string(),
                        data: None,
                    }
                })?;
                // let data=self.export_png_data(source, &document,page,pixel_per_pt)?;
                let width=document.pages[page_index].width();// in pt
                let height=document.pages[page_index].height();// in pt
                val=json!({
                    "height":height.to_raw(),
                    "width":width.to_raw(),
                    "page":page,
                    "total_page":document.pages.len(),
                    "typ":source.as_ref().path().to_string_lossy(),
                });
            };
        }
        self.update_all_diagnostics(workspace, diagnostics).await;
        Ok(Some(val))
    }
}
