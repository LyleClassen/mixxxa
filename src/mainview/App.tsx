import { useState } from "react";
import { CollectionTable } from "./components/CollectionTable";
import { PathPrompt } from "./components/PathPrompt";
import { PlaybackControls } from "./components/PlaybackControls";
import { audioPlayer } from "./lib/audio-player";
import { useCollection } from "./lib/useCollection";
import { getRekordboxPath } from "./lib/storage";
import type { Track } from "./lib/rekordbox-parser";

export default function App() {
	const [xmlPath, setXmlPath] = useState<string | null>(getRekordboxPath);
	const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
	const [playbackTrackId, setPlaybackTrackId] = useState<string | null>(null);

	const { tracks, loading, error } = useCollection(xmlPath);

	function handlePathSet(path: string) {
		setXmlPath(path);
	}

	function handleSelectTrack(track: Track) {
		setSelectedTrack(track);
	}

	// Keep playback track id in sync with the audio player
	useState(() => {
		return audioPlayer.subscribe((state) => {
			setPlaybackTrackId(state.currentTrackId);
		});
	});

	if (!xmlPath) {
		return (
			<div className="min-h-screen bg-gray-950">
				<PathPrompt onPathSet={handlePathSet} />
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
			{/* Toolbar */}
			<div className="flex items-center px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
				<span className="text-lg font-bold tracking-tight text-indigo-400">
					mixxxa
				</span>
				{loading && (
					<span className="ml-4 text-xs text-gray-500">Loading…</span>
				)}
				{!loading && tracks.length > 0 && (
					<span className="ml-4 text-xs text-gray-500">
						{tracks.length} tracks
					</span>
				)}
				<div className="flex-1" />
				<button
					type="button"
					className="text-xs text-gray-500 hover:text-gray-300"
					onClick={() => {
						setXmlPath(null);
						setSelectedTrack(null);
					}}
				>
					Change library…
				</button>
			</div>

			{/* Main content */}
			<div className="flex-1 overflow-hidden">
				{error ? (
					<div className="flex items-center justify-center h-full text-red-400 text-sm px-8 text-center">
						<div>
							<p className="font-medium mb-1">Failed to load rekordbox.xml</p>
							<p className="text-gray-500">{error}</p>
						</div>
					</div>
				) : (
					<CollectionTable
						tracks={tracks}
						currentTrackId={playbackTrackId}
						selectedTrackId={selectedTrack?.trackId ?? null}
						onSelectTrack={handleSelectTrack}
					/>
				)}
			</div>

			{/* Playback bar */}
			<PlaybackControls selectedTrack={selectedTrack} />
		</div>
	);
}
