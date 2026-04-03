import { useEffect, useState } from "react";
import { audioPlayer, type PlaybackState } from "../lib/audio-player";
import { Button } from "./ui/Button";
import type { Track } from "../lib/rekordbox-parser";

interface PlaybackControlsProps {
	selectedTrack: Track | null;
}

export function PlaybackControls({ selectedTrack }: PlaybackControlsProps) {
	const [playback, setPlayback] = useState<PlaybackState>(
		audioPlayer.getState(),
	);

	useEffect(() => {
		return audioPlayer.subscribe(setPlayback);
	}, []);

	const isPlayingSelected =
		playback.currentTrackId === selectedTrack?.trackId &&
		playback.status === "playing";

	function handlePlayPause() {
		if (!selectedTrack) return;
		if (isPlayingSelected) {
			audioPlayer.pause();
		} else {
			audioPlayer.play(selectedTrack.location, selectedTrack.trackId);
		}
	}

	function handleStop() {
		audioPlayer.stop();
	}

	return (
		<div className="flex items-center gap-3 px-4 py-2 bg-gray-950 border-t border-gray-800">
			<Button
				variant="primary"
				onClick={handlePlayPause}
				disabled={!selectedTrack}
				className="w-20"
			>
				{isPlayingSelected ? "Pause" : "Play"}
			</Button>
			<Button
				variant="ghost"
				onClick={handleStop}
				disabled={playback.status === "stopped"}
			>
				Stop
			</Button>

			<div className="flex-1 text-sm text-gray-400 truncate">
				{selectedTrack ? (
					<>
						<span className="text-white">{selectedTrack.title}</span>
						{selectedTrack.artist && (
							<span className="ml-2 text-gray-500">
								— {selectedTrack.artist}
							</span>
						)}
					</>
				) : (
					<span className="italic">No track selected</span>
				)}
			</div>

			{playback.status === "error" && playback.errorMessage && (
				<p className="text-xs text-red-400 shrink-0">{playback.errorMessage}</p>
			)}
		</div>
	);
}
