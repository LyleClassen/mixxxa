const REKORDBOX_PATH_KEY = "mixxxa:rekordboxPath";

export function getRekordboxPath(): string | null {
	return localStorage.getItem(REKORDBOX_PATH_KEY);
}

export function setRekordboxPath(path: string): void {
	localStorage.setItem(REKORDBOX_PATH_KEY, path);
}

export function clearRekordboxPath(): void {
	localStorage.removeItem(REKORDBOX_PATH_KEY);
}
