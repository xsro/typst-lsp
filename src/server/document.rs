use tower_lsp::lsp_types::TextDocumentContentChangeEvent;

use crate::config::{Config, ExportPdfMode};
use crate::lsp_typst_boundary::world::WorkspaceWorld;
use crate::lsp_typst_boundary::LspRange;
use crate::workspace::source::Source;

use super::TypstServer;
use super::log::LogMessage;

impl TypstServer {
    /// Apply a single change event to a document
    pub fn apply_single_document_change(
        &self,
        source: &mut Source,
        change: TextDocumentContentChangeEvent,
    ) {
        let replacement = change.text;

        match change.range {
            Some(range) => {
                let range = LspRange::new(range, self.get_const_config().position_encoding);
                source.edit(&range, &replacement);
            }
            None => source.replace(replacement),
        }
    }

    pub async fn on_source_changed(
        &self,
        world: &WorkspaceWorld,
        config: &Config,
        source: &Source,
    ) {
        self.run_diagnostics_and_export(world, source,config).await;
    }

    pub async fn run_export(&self, world: &WorkspaceWorld, source: &Source) {
        let (document, _) = self.compile_source(world);

        if let Some(document) = document {
            self.export_pdf(source, &document).await;
        }
    }

    pub async fn run_diagnostics_and_export(&self, world: &WorkspaceWorld, source: &Source,config: &Config) {
        let (document, diagnostics) = self.compile_source(world);

        self.update_all_diagnostics(world.get_workspace(), diagnostics)
            .await;
        if let Some(document) = document {
            let out=super::preview::export_png(source,&document, &config.png).unwrap();
            let msg=LogMessage{
                message_type: tower_lsp::lsp_types::MessageType::INFO,
                message: format!("exported to {}",out.to_str().unwrap()),
            };
            self.log_to_client(msg).await;
            if config.export_pdf==ExportPdfMode::OnType{
                self.export_pdf(source, &document).await;
            }
        }
    }
}
