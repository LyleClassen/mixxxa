import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';
import { AudioPlayer } from './components/AudioPlayer';
import { CollectionLoader } from './components/CollectionLoader';
import { NavigationPane } from './components/NavigationPane';
import { TrackListing } from './components/TrackListing';
import './index.css';
import type { NavNode, NavView, Track } from './types';

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function App() {
  const [navTree, setNavTree] = useState<NavNode[] | null>(null);
  const [xmlPath, setXmlPath] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedView, setSelectedView] = useState<NavView>({ kind: 'all' });
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [loadingTracks, setLoadingTracks] = useState(false);

  async function handleCollectionLoaded(tree: NavNode[], collectionPath: string) {
    setNavTree(tree);
    setXmlPath(collectionPath);
    setSelectedView({ kind: 'all' });
    setLoadingTracks(true);
    try {
      const allTracks = await invoke<Track[]>('get_all_tracks');
      setTracks(allTracks);
    } catch (err) {
      console.error('Failed to fetch tracks:', err);
    } finally {
      setLoadingTracks(false);
    }
  }

  async function handleSelectView(view: NavView) {
    setSelectedView(view);
    setLoadingTracks(true);
    try {
      if (view.kind === 'all') {
        const allTracks = await invoke<Track[]>('get_all_tracks');
        setTracks(allTracks);
      } else {
        const playlistTracks = await invoke<Track[]>('get_playlist_tracks', {
          playlistId: view.playlistId,
        });
        setTracks(playlistTracks);
      }
    } catch (err) {
      console.error('Failed to fetch tracks:', err);
    } finally {
      setLoadingTracks(false);
    }
  }

  function handleSelectTrack(track: Track) {
    setSelectedTrackId(track.id);
    setCurrentTrack(track);
  }

  if (!navTree) {
    return <CollectionLoader onLoaded={handleCollectionLoaded} />;
  }

  const viewTitle =
    selectedView.kind === 'all' ? 'All Tracks' : selectedView.name;

  return (
    <div className="flex h-screen flex-col bg-[#0f0f11] overflow-hidden">
      {/* Fixed top header + audio player */}
      <header className="flex h-16 flex-shrink-0 items-center border-b border-[#2e2e36] bg-[#0f0f11]">
        {/* App name section */}
        <div className="flex w-[260px] flex-shrink-0 items-center gap-3 border-r border-[#2e2e36] px-4">
          <span className="text-lg font-bold tracking-tight text-[#e8e8f0]">mixxxa</span>
          {xmlPath && (
            <span
              className="truncate text-xs text-[#55556a]"
              title={xmlPath}
            >
              {getFileName(xmlPath)}
            </span>
          )}
        </div>

        {/* Audio player */}
        <div className="flex-1">
          <AudioPlayer track={currentTrack} />
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left nav pane */}
        <div className="w-[260px] flex-shrink-0">
          <NavigationPane
            navTree={navTree}
            selectedView={selectedView}
            onSelectView={handleSelectView}
          />
        </div>

        {/* Track listing */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* View title bar */}
          <div className="flex h-10 flex-shrink-0 items-center border-b border-[#2e2e36] px-4">
            <h2 className="text-sm font-semibold text-[#e8e8f0]">{viewTitle}</h2>
            {tracks.length > 0 && (
              <span className="ml-2 text-xs text-[#55556a]">{tracks.length} tracks</span>
            )}
          </div>

          {loadingTracks ? (
            <div className="flex flex-1 items-center justify-center text-[#55556a] text-sm">
              Loading…
            </div>
          ) : (
            <TrackListing
              tracks={tracks}
              selectedTrackId={selectedTrackId}
              onSelectTrack={handleSelectTrack}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
