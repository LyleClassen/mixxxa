import { useState } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { rpc } from "../lib/rpc";
import { setRekordboxPath } from "../lib/storage";

interface PathPromptProps {
	onPathSet: (path: string) => void;
}

export function PathPrompt({ onPathSet }: PathPromptProps) {
	const [manualPath, setManualPath] = useState("");
	const [error, setError] = useState<string | null>(null);

	async function handleBrowse() {
		try {
			const result = await rpc.request.openFileDialog({
				allowedFileTypes: "xml",
			});
			if (result) {
				setRekordboxPath(result);
				onPathSet(result);
			}
		} catch (err) {
			setError("Failed to open file dialog.");
			console.error(err);
		}
	}

	function handleManualSubmit() {
		const path = manualPath.trim();
		if (!path) {
			setError("Please enter a path.");
			return;
		}
		setRekordboxPath(path);
		onPathSet(path);
	}

	return (
		<Dialog open title="Locate your Rekordbox library" onOpenChange={() => {}}>
			<p className="text-sm text-gray-400 mb-4">
				Select your <code className="text-indigo-400">rekordbox.xml</code>{" "}
				export file. In Rekordbox 7, go to{" "}
				<strong>Preferences → Advanced → rekordbox xml</strong> and export your
				collection.
			</p>
			<Button className="w-full mb-4" onClick={handleBrowse}>
				Browse for rekordbox.xml…
			</Button>
			<p className="text-xs text-gray-500 mb-2">Or enter the path manually:</p>
			<div className="flex gap-2">
				<Input
					value={manualPath}
					onChange={(e) => setManualPath(e.target.value)}
					placeholder="/path/to/rekordbox.xml"
				/>
				<Button variant="secondary" onClick={handleManualSubmit}>
					OK
				</Button>
			</div>
			{error && <p className="text-xs text-red-400 mt-2">{error}</p>}
		</Dialog>
	);
}
