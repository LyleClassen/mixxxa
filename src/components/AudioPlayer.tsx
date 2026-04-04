import { convertFileSrc } from '@tauri-apps/api/core';
import { Pause, Play, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Track } from '../types';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

interface AudioPlayerProps {
  track: Track | null;
}

export function AudioPlayer({ track }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [audioError, setAudioError] = useState<string | null>(null);

  // When track changes, reset state and load new source
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsPlaying(false);
    setAudioError(null);

    if (track?.file_path) {
      audio.src = convertFileSrc(track.file_path);
      audio.load();
    } else {
      audio.src = '';
    }
  }, [track?.file_path]);

  // Keep volume in sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !track) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
        setAudioError(null);
      } catch (err) {
        setAudioError(`Unable to play this track: ${String(err)}`);
      }
    }
  }

  function handleEnded() {
    setIsPlaying(false);
  }

  function handleError() {
    setIsPlaying(false);
    setAudioError('Unable to play this track');
  }

  return (
    <div className="flex h-full items-center gap-4 px-4">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onError={handleError}
        preload="none"
      />

      {/* Play/pause button */}
      <Button
        variant="ghost"
        size="icon"
        disabled={!track || !!audioError}
        onClick={togglePlay}
        className="h-9 w-9 rounded-full bg-[#6c5ce7]/10 text-[#6c5ce7] hover:bg-[#6c5ce7]/20 disabled:opacity-40"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 translate-x-0.5" />
        )}
      </Button>

      {/* Track info */}
      <div className="min-w-0 flex-1">
        {track ? (
          <>
            <p className="truncate text-sm font-medium text-[#e8e8f0]">{track.title || 'Unknown Title'}</p>
            <p className="truncate text-xs text-[#8888a0]">{track.artist || 'Unknown Artist'}</p>
          </>
        ) : (
          <p className="text-sm text-[#55556a]">No track selected</p>
        )}
        {audioError && (
          <p className="mt-0.5 text-xs text-[#d63031]">{audioError}</p>
        )}
      </div>

      {/* Volume control */}
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 flex-shrink-0 text-[#55556a]" />
        <Slider
          value={[volume * 100]}
          onValueChange={([v]) => setVolume((v ?? 80) / 100)}
          min={0}
          max={100}
          step={1}
          className="w-24"
          aria-label="Volume"
        />
      </div>
    </div>
  );
}
