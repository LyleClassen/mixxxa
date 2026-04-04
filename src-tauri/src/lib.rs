mod error;
mod models;
mod parser;

use std::sync::Mutex;

use models::{Collection, NavNode, Track};
use error::AppError;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const XML_PATH_KEY: &str = "xml_path";

pub struct AppState(pub Mutex<Option<Collection>>);

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_stored_xml_path(app: AppHandle) -> Result<Option<String>, AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Store(e.to_string()))?;
    let value = store.get(XML_PATH_KEY);
    match value {
        Some(v) => Ok(v.as_str().map(String::from)),
        None => Ok(None),
    }
}

#[tauri::command]
async fn save_xml_path(app: AppHandle, path: String) -> Result<(), AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Store(e.to_string()))?;
    store.set(XML_PATH_KEY, serde_json::Value::String(path));
    store.save().map_err(|e| AppError::Store(e.to_string()))?;
    Ok(())
}

#[tauri::command]
async fn open_file_dialog(app: AppHandle) -> Result<Option<String>, AppError> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Rekordbox XML", &["xml"])
        .blocking_pick_file();

    match file_path {
        Some(FilePath::Path(p)) => Ok(Some(p.to_string_lossy().into_owned())),
        _ => Ok(None),
    }
}

#[tauri::command]
async fn load_collection(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<NavNode>, AppError> {
    let collection = parser::parse_rekordbox_xml(&path)?;
    let nav_tree = collection.nav_tree.clone();
    let mut guard = state.0.lock().unwrap();
    *guard = Some(collection);
    Ok(nav_tree)
}

#[tauri::command]
async fn get_all_tracks(state: State<'_, AppState>) -> Result<Vec<Track>, AppError> {
    let guard = state.0.lock().unwrap();
    match guard.as_ref() {
        Some(collection) => {
            let mut tracks: Vec<Track> = collection.tracks.values().cloned().collect();
            tracks.sort_by(|a, b| a.title.cmp(&b.title));
            Ok(tracks)
        }
        None => Err(AppError::CollectionNotLoaded),
    }
}

#[tauri::command]
async fn get_playlist_tracks(
    playlist_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Track>, AppError> {
    let guard = state.0.lock().unwrap();
    let collection = guard.as_ref().ok_or(AppError::CollectionNotLoaded)?;

    let track_ids = find_playlist_tracks(&collection.nav_tree, &playlist_id)
        .ok_or_else(|| AppError::PlaylistNotFound(playlist_id.clone()))?;

    let tracks: Vec<Track> = track_ids
        .iter()
        .filter_map(|id| collection.tracks.get(id))
        .cloned()
        .collect();

    Ok(tracks)
}

fn find_playlist_tracks<'a>(
    nodes: &'a Vec<NavNode>,
    playlist_id: &str,
) -> Option<&'a Vec<String>> {
    for node in nodes {
        match node {
            NavNode::Playlist(p) if p.id == playlist_id => {
                return Some(&p.track_ids);
            }
            NavNode::Folder(f) => {
                if let Some(ids) = find_playlist_tracks(&f.children, playlist_id) {
                    return Some(ids);
                }
            }
            _ => {}
        }
    }
    None
}

// ─── App Setup ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            get_stored_xml_path,
            save_xml_path,
            open_file_dialog,
            load_collection,
            get_all_tracks,
            get_playlist_tracks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
