use std::fs;

use tower_lsp::jsonrpc::{Error,Result,ErrorCode};
use typst::doc::Document;

use crate::workspace::source::Source;

use super::TypstServer;

impl TypstServer {
    pub fn export_pdf(&self, source: &Source, document: &Document)->Result<()> {
        let buffer = typst::export::pdf(document);
        let output_path = source.as_ref().path().with_extension("pdf");

        fs::write(&output_path, buffer).map_err(|e|{Error{
            code:ErrorCode::ServerError(5),
            message: e.to_string(),
            data: None,
        }})
    }
}
