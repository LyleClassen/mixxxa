import { invoke } from '@tauri-apps/api/core';
import { FolderOpen, Music2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { NavNode } from '../types';
import { Button } from './ui/button';

interface CollectionLoaderProps {
  onLoaded: (navTree: NavNode[], xmlPath: string) => void;
}

export function CollectionLoader({ onLoaded }: CollectionLoaderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    checkStoredPath();
  }, []);

  async function checkStoredPath() {
    try {
      const path = await invoke<string | null>('get_stored_xml_path');
      if (path) {
        await loadCollection(path);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  async function loadCollection(path: string) {
    setLoading(true);
    setError(null);
    try {
      const navTree = await invoke<NavNode[]>('load_collection', { path });
      onLoaded(navTree, path);
    } catch (err) {
      setLoading(false);
      const msg = String(err);
      if (msg.includes('not found') || msg.includes('No such file')) {
        setError('The previously selected collection file could not be found. Please select it again.');
      } else {
        setError(`Failed to load collection: ${msg}`);
      }
    }
  }

  async function handleSelectCollection() {
    setCancelled(false);
    setError(null);
    try {
      const path = await invoke<string | null>('open_file_dialog');
      if (!path) {
        setCancelled(true);
        return;
      }
      await invoke('save_xml_path', { path });
      await loadCollection(path);
    } catch (err) {
      setError(`Error: ${String(err)}`);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0f0f11]">
        <div className="flex flex-col items-center gap-4 text-[#8888a0]">
          <Music2 className="h-12 w-12 animate-pulse text-[#6c5ce7]" />
          <p className="text-sm">Loading collection…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-[#0f0f11] p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#6c5ce7]/10 ring-1 ring-[#6c5ce7]/30">
          <Music2 className="h-10 w-10 text-[#6c5ce7]" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#e8e8f0]">mixxxa</h1>
        <p className="text-[#8888a0]">Your Rekordbox collection browser</p>
      </div>

      <div className="w-full max-w-md rounded-xl border border-[#2e2e36] bg-[#1a1a1f] p-6 text-center">
        <h2 className="mb-2 text-lg font-semibold text-[#e8e8f0]">Select your collection</h2>
        <p className="mb-6 text-sm text-[#8888a0]">
          Open Rekordbox → File → Export Collection in xml format, then select the exported{' '}
          <code className="rounded bg-[#242429] px-1.5 py-0.5 font-mono text-xs text-[#6c5ce7]">
            rekordbox.xml
          </code>{' '}
          file.
        </p>

        <Button
          onClick={handleSelectCollection}
          className="w-full bg-[#6c5ce7] hover:bg-[#7d6ff0] text-white font-semibold"
          size="lg"
        >
          <FolderOpen className="mr-2 h-5 w-5" />
          Select Collection
        </Button>

        {cancelled && (
          <p className="mt-3 text-sm text-[#8888a0]">
            No file selected. Click the button above to choose your Rekordbox XML file.
          </p>
        )}

        {error && (
          <p className="mt-3 text-sm text-[#d63031]">{error}</p>
        )}
      </div>
    </div>
  );
}
