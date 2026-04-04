import { useState } from "react";
import type { Track } from "../lib/rekordbox-parser";

type SortKey =
	| "title"
	| "artist"
	| "album"
	| "bpm"
	| "key"
	| "genre"
	| "duration";
type SortDir = "asc" | "desc";

function formatDuration(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBpm(bpm: number | null): string {
	if (bpm === null) return "—";
	return bpm.toFixed(2);
}

interface CollectionTableProps {
	tracks: Track[];
	currentTrackId: string | null;
	selectedTrackId: string | null;
	onSelectTrack: (track: Track) => void;
}

export function CollectionTable({
	tracks,
	currentTrackId,
	selectedTrackId,
	onSelectTrack,
}: CollectionTableProps) {
	const [sortKey, setSortKey] = useState<SortKey>("title");
	const [sortDir, setSortDir] = useState<SortDir>("asc");

	function handleColumnClick(key: SortKey) {
		if (key === sortKey) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir("asc");
		}
	}

	const sorted = [...tracks].sort((a, b) => {
		let valA: string | number | null = a[sortKey];
		let valB: string | number | null = b[sortKey];

		if (valA === null) valA = sortKey === "bpm" ? -1 : "";
		if (valB === null) valB = sortKey === "bpm" ? -1 : "";

		const cmp =
			typeof valA === "number" && typeof valB === "number"
				? valA - valB
				: String(valA).localeCompare(String(valB));

		return sortDir === "asc" ? cmp : -cmp;
	});

	if (tracks.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
				<p className="text-lg">No tracks in collection.</p>
				<p className="text-sm">
					Make sure your rekordbox.xml has been exported from Rekordbox 7.
				</p>
			</div>
		);
	}

	const columns: { key: SortKey | "#" | ""; label: string; width: string }[] = [
		{ key: "", label: "", width: "w-6" }, // play indicator
		{ key: "#", label: "#", width: "w-10" },
		{ key: "title", label: "Title", width: "flex-1 min-w-0" },
		{ key: "artist", label: "Artist", width: "w-44" },
		{ key: "album", label: "Album", width: "w-44" },
		{ key: "bpm", label: "BPM", width: "w-20" },
		{ key: "key", label: "Key", width: "w-14" },
		{ key: "genre", label: "Genre", width: "w-28" },
		{ key: "duration", label: "Time", width: "w-16" },
	];

	return (
		<div className="flex flex-col h-full overflow-hidden text-sm">
			{/* Header */}
			<div className="flex items-center px-2 py-1 border-b border-gray-700 bg-gray-900 text-gray-400 text-xs font-medium select-none shrink-0">
				{columns.map((col) => (
					// biome-ignore lint/a11y/noStaticElementInteractions: div-based table layout; role set conditionally
					<div
						key={col.label}
						role={col.key && col.key !== "#" ? "button" : undefined}
						tabIndex={col.key && col.key !== "#" ? 0 : undefined}
						className={`${col.width} px-1 truncate ${col.key && col.key !== "#" ? "cursor-pointer hover:text-white" : ""}`}
						onClick={() => {
							if (col.key && col.key !== "#") {
								handleColumnClick(col.key as SortKey);
							}
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" && col.key && col.key !== "#") {
								handleColumnClick(col.key as SortKey);
							}
						}}
					>
						{col.label}
						{col.key === sortKey && (
							<span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>
						)}
					</div>
				))}
			</div>

			{/* Rows */}
			<div className="flex-1 overflow-y-auto">
				{sorted.map((track, idx) => {
					const isSelected = track.trackId === selectedTrackId;
					const isPlaying = track.trackId === currentTrackId;

					return (
						<div
							key={track.trackId}
							role="option"
							tabIndex={0}
							className={`flex items-center px-2 py-1 cursor-pointer select-none border-b border-gray-800 ${
								isSelected
									? "bg-indigo-700/60 text-white"
									: "text-gray-300 hover:bg-gray-800"
							}`}
							onClick={() => onSelectTrack(track)}
							onKeyDown={(e) => e.key === "Enter" && onSelectTrack(track)}
						>
							{/* Play indicator */}
							<div className="w-6 px-1 text-indigo-400 shrink-0">
								{isPlaying ? "▶" : ""}
							</div>
							{/* Row number */}
							<div className="w-10 px-1 text-gray-500 shrink-0">{idx + 1}</div>
							{/* Title */}
							<div className="flex-1 min-w-0 px-1 truncate">
								{track.title || "—"}
							</div>
							{/* Artist */}
							<div className="w-44 px-1 truncate shrink-0">
								{track.artist || "—"}
							</div>
							{/* Album */}
							<div className="w-44 px-1 truncate shrink-0">
								{track.album || "—"}
							</div>
							{/* BPM */}
							<div className="w-20 px-1 shrink-0">{formatBpm(track.bpm)}</div>
							{/* Key */}
							<div className="w-14 px-1 shrink-0">{track.key || "—"}</div>
							{/* Genre */}
							<div className="w-28 px-1 truncate shrink-0">
								{track.genre || "—"}
							</div>
							{/* Duration */}
							<div className="w-16 px-1 shrink-0">
								{formatDuration(track.duration)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
