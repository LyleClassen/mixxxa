import { useCallback, useEffect, useRef, useState } from "react";
import { parseRekordboxXml, type Track } from "./rekordbox-parser";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface CollectionState {
	tracks: Track[];
	loading: boolean;
	error: string | null;
}

async function loadXml(path: string): Promise<string> {
	// In Electrobun's browser context the file:// scheme is accessible via fetch.
	// Encode the path so spaces etc. are safe.
	const url = `file://${path.startsWith("/") ? "" : "/"}${encodeURI(path)}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
	return res.text();
}

export function useCollection(xmlPath: string | null) {
	const [state, setState] = useState<CollectionState>({
		tracks: [],
		loading: false,
		error: null,
	});

	// Track the last loaded content hash to avoid unnecessary re-parses
	const lastContentRef = useRef<string | null>(null);

	const load = useCallback(async () => {
		if (!xmlPath) return;
		try {
			const content = await loadXml(xmlPath);
			if (content === lastContentRef.current) return; // no change
			lastContentRef.current = content;
			const tracks = parseRekordboxXml(content);
			setState({ tracks, loading: false, error: null });
		} catch (err) {
			setState((prev) => ({
				...prev,
				loading: false,
				error: err instanceof Error ? err.message : String(err),
			}));
		}
	}, [xmlPath]);

	// Initial load
	useEffect(() => {
		if (!xmlPath) return;
		setState((prev) => ({ ...prev, loading: true }));
		load();
	}, [xmlPath, load]);

	// 5-minute polling
	useEffect(() => {
		if (!xmlPath) return;
		const id = setInterval(load, POLL_INTERVAL_MS);
		return () => clearInterval(id);
	}, [xmlPath, load]);

	return state;
}
