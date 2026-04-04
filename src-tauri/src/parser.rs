use quick_xml::Reader;
use quick_xml::events::Event;
use std::collections::HashMap;

use crate::error::AppError;
use crate::models::{Collection, Folder, NavNode, Playlist, Track};

pub fn parse_rekordbox_xml(path: &str) -> Result<Collection, AppError> {
    let content = std::fs::read_to_string(path)?;
    let mut reader = Reader::from_str(&content);
    reader.config_mut().trim_text(true);

    let mut tracks: HashMap<String, Track> = HashMap::new();
    let mut nav_tree: Vec<NavNode> = Vec::new();

    // We do two passes: first collect tracks, then parse the NODE/PLAYLIST tree
    // Actually, quick-xml is streaming, so we track state as we go.

    #[derive(Debug)]
    enum ParseState {
        Root,
        InCollection,
        InPlaylists,
    }

    #[derive(Debug)]
    struct FolderBuilder {
        id: String,
        name: String,
        children: Vec<NavNode>,
    }

    let mut state = ParseState::Root;
    let mut node_stack: Vec<FolderBuilder> = Vec::new();
    // playlist being currently built (inside a PLAYLIST node)
    let mut current_playlist: Option<Playlist> = None;

    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                match e.name().as_ref() {
                    b"COLLECTION" => {
                        state = ParseState::InCollection;
                    }
                    b"PLAYLISTS" => {
                        state = ParseState::InPlaylists;
                    }
                    b"TRACK" => {
                        if matches!(state, ParseState::InCollection) {
                            if let Some(track) = parse_track_element(&e)? {
                                tracks.insert(track.id.clone(), track);
                            }
                        } else {
                            // TRACK inside a PLAYLIST — it's a track reference
                            if let Some(playlist) = current_playlist.as_mut() {
                                let track_id = get_attr(&e, b"Key")?.unwrap_or_default();
                                if !track_id.is_empty() {
                                    playlist.track_ids.push(track_id);
                                }
                            }
                        }
                    }
                    b"NODE" => {
                        let node_type = get_attr(&e, b"Type")?.unwrap_or_default();
                        let name = get_attr(&e, b"Name")?.unwrap_or_default();
                        let id = get_attr(&e, b"Id")
                            .unwrap_or_default()
                            .unwrap_or_else(|| name.clone());

                        if node_type == "0" {
                            // Folder node
                            node_stack.push(FolderBuilder {
                                id,
                                name,
                                children: Vec::new(),
                            });
                        } else if node_type == "1" {
                            // Playlist node — start collecting track refs
                            current_playlist = Some(Playlist {
                                id: id.clone(),
                                name: name.clone(),
                                track_ids: Vec::new(),
                            });
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(e)) => {
                match e.name().as_ref() {
                    b"TRACK" => {
                        if matches!(state, ParseState::InCollection) {
                            if let Some(track) = parse_track_element(&e)? {
                                tracks.insert(track.id.clone(), track);
                            }
                        } else if let Some(playlist) = current_playlist.as_mut() {
                            let track_id = get_attr(&e, b"Key")?.unwrap_or_default();
                            if !track_id.is_empty() {
                                playlist.track_ids.push(track_id);
                            }
                        }
                    }
                    b"NODE" => {
                        // Self-closing NODE (empty playlist)
                        let node_type = get_attr(&e, b"Type")?.unwrap_or_default();
                        let name = get_attr(&e, b"Name")?.unwrap_or_default();
                        let id = get_attr(&e, b"Id")
                            .unwrap_or_default()
                            .unwrap_or_else(|| name.clone());

                        if node_type == "1" {
                            let playlist = Playlist {
                                id,
                                name,
                                track_ids: Vec::new(),
                            };
                            let node = NavNode::Playlist(playlist);
                            if let Some(parent) = node_stack.last_mut() {
                                parent.children.push(node);
                            } else {
                                nav_tree.push(node);
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(e)) => {
                match e.name().as_ref() {
                    b"COLLECTION" => {
                        state = ParseState::Root;
                    }
                    b"PLAYLISTS" => {
                        state = ParseState::Root;
                    }
                    b"NODE" => {
                        if let Some(playlist) = current_playlist.take() {
                            // Closing a playlist node
                            let node = NavNode::Playlist(playlist);
                            if let Some(parent) = node_stack.last_mut() {
                                parent.children.push(node);
                            } else {
                                nav_tree.push(node);
                            }
                        } else if let Some(folder) = node_stack.pop() {
                            // Closing a folder node
                            let node = NavNode::Folder(Folder {
                                id: folder.id,
                                name: folder.name,
                                children: folder.children,
                            });
                            if let Some(parent) = node_stack.last_mut() {
                                parent.children.push(node);
                            } else {
                                nav_tree.push(node);
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(AppError::XmlParse(e.to_string()));
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(Collection { tracks, nav_tree })
}

fn get_attr(
    e: &quick_xml::events::BytesStart<'_>,
    name: &[u8],
) -> Result<Option<String>, AppError> {
    for attr in e.attributes() {
        let attr = attr.map_err(|e| AppError::XmlParse(e.to_string()))?;
        if attr.key.as_ref() == name {
            let value = attr
                .unescape_value()
                .map_err(|e| AppError::XmlParse(e.to_string()))?;
            return Ok(Some(value.into_owned()));
        }
    }
    Ok(None)
}

fn parse_track_element(
    e: &quick_xml::events::BytesStart<'_>,
) -> Result<Option<Track>, AppError> {
    let id = match get_attr(e, b"TrackID")? {
        Some(v) if !v.is_empty() => v,
        _ => return Ok(None),
    };

    // Skip entries that have no file path (they're placeholders)
    let file_path = get_attr(e, b"Location")?.unwrap_or_default();

    let title = get_attr(e, b"Name")?.unwrap_or_default();
    let artist = get_attr(e, b"Artist")?.unwrap_or_default();
    let album = get_attr(e, b"Album")?.unwrap_or_default();
    let bpm: f32 = get_attr(e, b"AverageBpm")?
        .unwrap_or_default()
        .parse()
        .unwrap_or(0.0);
    let key = get_attr(e, b"Tonality")?.unwrap_or_default();
    let duration: u32 = get_attr(e, b"TotalTime")?
        .unwrap_or_default()
        .parse()
        .unwrap_or(0);
    let genre = get_attr(e, b"Genre")?.unwrap_or_default();

    // Decode the file:// URL to an absolute OS path
    let file_path = decode_rekordbox_path(&file_path);

    Ok(Some(Track {
        id,
        title,
        artist,
        album,
        bpm,
        key,
        duration,
        genre,
        file_path,
    }))
}

/// Rekordbox stores paths as file://localhost/absolute/path
/// We decode percent-encoding and strip the file://localhost prefix.
fn decode_rekordbox_path(raw: &str) -> String {
    let path = if let Some(p) = raw.strip_prefix("file://localhost") {
        p
    } else if let Some(p) = raw.strip_prefix("file://") {
        p
    } else {
        raw
    };

    // Percent-decode
    let decoded = percent_decode(path);

    // WSL: translate Windows drive paths (/C:/...) to WSL mount paths (/mnt/c/...)
    // Triggered automatically when WSL_DISTRO_NAME is set, or explicitly via WSL_DEVELOPMENT=true
    if is_wsl() {
        if let Some(rest) = decoded.strip_prefix('/') {
            let mut chars = rest.chars();
            if let Some(drive) = chars.next() {
                if drive.is_ascii_alphabetic() && chars.next() == Some(':') {
                    let remainder = &rest[2..]; // everything after drive letter and colon
                    return format!("/mnt/{}{}", drive.to_ascii_lowercase(), remainder);
                }
            }
        }
    }

    decoded
}

fn is_wsl() -> bool {
    std::env::var("WSL_DISTRO_NAME").is_ok()
        || std::env::var("WSL_DEVELOPMENT")
            .map(|v| v == "true")
            .unwrap_or(false)
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut result = String::with_capacity(s.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                result.push(char::from(h * 16 + l));
                i += 3;
                continue;
            }
        }
        result.push(char::from(bytes[i]));
        i += 1;
    }
    result
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}
