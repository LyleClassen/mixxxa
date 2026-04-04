use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub bpm: f32,
    pub key: String,
    pub duration: u32, // seconds
    pub genre: String,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub track_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub children: Vec<NavNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum NavNode {
    Folder(Folder),
    Playlist(Playlist),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub tracks: HashMap<String, Track>,
    pub nav_tree: Vec<NavNode>,
}
