use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("XML parse error: {0}")]
    XmlParse(String),

    #[error("Collection not loaded")]
    CollectionNotLoaded,

    #[error("Playlist not found: {0}")]
    PlaylistNotFound(String),

    #[error("Store error: {0}")]
    Store(String),

}

// Required for Tauri IPC boundary
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
