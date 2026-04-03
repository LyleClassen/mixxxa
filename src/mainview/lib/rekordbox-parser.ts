import { XMLParser } from "fast-xml-parser";

export interface Track {
	trackId: string;
	title: string;
	artist: string;
	album: string;
	bpm: number | null;
	key: string;
	genre: string;
	duration: number; // seconds
	location: string; // decoded local file path
}

// Rekordbox XML Location uses "file://localhost/..." prefix on macOS/Windows
const LOCATION_PREFIXES = ["file://localhost", "file://"];

function decodeLocation(raw: string): string {
	let path = raw;
	for (const prefix of LOCATION_PREFIXES) {
		if (path.startsWith(prefix)) {
			path = path.slice(prefix.length);
			break;
		}
	}
	return decodeURIComponent(path);
}

function str(val: unknown): string {
	if (val === undefined || val === null) return "";
	return String(val);
}

function parseMinSec(raw: unknown): number {
	// Rekordbox stores TotalTime as "m:ss" or total seconds
	if (raw === undefined || raw === null) return 0;
	const s = String(raw);
	if (s.includes(":")) {
		const [m, sec] = s.split(":").map(Number);
		return (m ?? 0) * 60 + (sec ?? 0);
	}
	return Math.round(Number(s)) || 0;
}

// biome-ignore lint/suspicious/noExplicitAny: third-party XML parse result
function extractTracks(parsed: any): Track[] {
	const collection = parsed?.DJ_PLAYLISTS?.COLLECTION ?? null;

	if (!collection) return [];

	// fast-xml-parser returns array when multiple elements, object when single
	const rawTracks = collection.TRACK;
	if (!rawTracks) return [];
	const trackArray = Array.isArray(rawTracks) ? rawTracks : [rawTracks];

	return trackArray
		.map((t: Record<string, unknown>): Track | null => {
			const location = str(t["@_Location"] ?? t.Location);
			if (!location) return null;

			const bpmRaw = t["@_AverageBpm"] ?? t.AverageBpm;
			const bpm = bpmRaw !== undefined ? Number(bpmRaw) || null : null;

			return {
				trackId: str(t["@_TrackID"] ?? t.TrackID),
				title: str(t["@_Name"] ?? t.Name),
				artist: str(t["@_Artist"] ?? t.Artist),
				album: str(t["@_Album"] ?? t.Album),
				bpm,
				key: str(t["@_Tonality"] ?? t.Tonality),
				genre: str(t["@_Genre"] ?? t.Genre),
				duration: parseMinSec(t["@_TotalTime"] ?? t.TotalTime),
				location: decodeLocation(location),
			};
		})
		.filter((t): t is Track => t !== null);
}

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	parseAttributeValue: true,
});

export function parseRekordboxXml(xmlContent: string): Track[] {
	const parsed = parser.parse(xmlContent);
	return extractTracks(parsed);
}
