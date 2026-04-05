import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { Pause, Play, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Track } from '../types';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

interface AudioPlayerProps {
  track: Track | null;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export function AudioPlayer({ track }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  // When track changes, reset state and load new source
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsPlaying(false);
    setAudioError(null);
    setCurrentTime(0);
    setDuration(0);

    if (track?.file_path) {
      const src = convertFileSrc(track.file_path);
      console.log('[AudioPlayer] file_path:', track.file_path);
      console.log('[AudioPlayer] asset url:', src);
      invoke<string>('check_file', { path: track.file_path })
        .then(r => console.log('[AudioPlayer] rust file check:', r))
        .catch(e => console.error('[AudioPlayer] rust file check failed:', e));
      audio.src = src;
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
    const audio = audioRef.current;
    const code = audio?.error?.code;
    const msg = audio?.error?.message ?? 'unknown';
    console.error('[AudioPlayer] MediaError code:', code, msg);
    setIsPlaying(false);
    setAudioError(`Unable to play this track (MediaError ${code})`);
  }

  return (
    <div className="flex h-full items-center gap-4 px-4">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onError={handleError}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        preload="metadata"
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
      <div className="w-40 shrink-0">
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

      {/* Seek bar */}
      <Slider
        value={[currentTime]}
        onValueChange={([v]) => {
          if (audioRef.current) audioRef.current.currentTime = v ?? 0;
        }}
        min={0}
        max={duration || 1}
        step={0.1}
        disabled={!track || !duration}
        className="flex-1"
        aria-label="Seek"
      />

      {/* Time display */}
      <span className="w-20 shrink-0 text-center text-xs tabular-nums text-[#55556a]">
        {fmt(currentTime)} / {fmt(duration)}
      </span>

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
