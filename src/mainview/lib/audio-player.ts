import { rpc } from "./rpc";

export type PlaybackStatus = "stopped" | "playing" | "paused" | "error";

export interface PlaybackState {
	status: PlaybackStatus;
	currentTrackId: string | null;
	errorMessage: string | null;
}

type Listener = (state: PlaybackState) => void;

class AudioPlayer {
	private audio: HTMLAudioElement = new Audio();
	private state: PlaybackState = {
		status: "stopped",
		currentTrackId: null,
		errorMessage: null,
	};
	private listeners: Set<Listener> = new Set();

	constructor() {
		this.audio.addEventListener("ended", () =>
			this.update({ status: "stopped" }),
		);
		this.audio.addEventListener("error", () => {
			const msg = this.audio.error
				? `Audio error (code ${this.audio.error.code})`
				: "Unknown audio error";
			this.update({ status: "error", errorMessage: msg });
		});
	}

	private update(patch: Partial<PlaybackState>) {
		this.state = { ...this.state, ...patch };
		for (const fn of this.listeners) fn(this.state);
	}

	subscribe(fn: Listener): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	getState(): PlaybackState {
		return this.state;
	}

	async play(filePath: string, trackId: string) {
		if (
			this.state.currentTrackId === trackId &&
			this.state.status === "paused"
		) {
			this.audio
				.play()
				.then(() => this.update({ status: "playing", errorMessage: null }));
			return;
		}

		const url = await getAudioUrl(filePath);

		this.audio.pause();
		this.audio.src = url;
		this.audio.load();
		this.update({
			status: "playing",
			currentTrackId: trackId,
			errorMessage: null,
		});
		this.audio.play().catch((err) => {
			this.update({ status: "error", errorMessage: String(err) });
		});
	}

	pause() {
		this.audio.pause();
		this.update({ status: "paused" });
	}

	stop() {
		this.audio.pause();
		this.audio.src = "";
		this.update({
			status: "stopped",
			currentTrackId: null,
			errorMessage: null,
		});
	}
}

let audioServerPort: number | null = null;

async function getAudioUrl(filePath: string): Promise<string> {
	if (audioServerPort === null) {
		audioServerPort = await rpc.request.getAudioServerPort({});
	}
	return `http://localhost:${audioServerPort}/audio?path=${encodeURIComponent(filePath)}`;
}

// Singleton
export const audioPlayer = new AudioPlayer();
