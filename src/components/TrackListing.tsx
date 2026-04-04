import { Music } from 'lucide-react';
import type { Track } from '../types';
import { cn } from '../lib/utils';
import { ScrollArea } from './ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

interface TrackListingProps {
  tracks: Track[];
  selectedTrackId: string | null;
  onSelectTrack: (track: Track) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TrackListing({ tracks, selectedTrackId, onSelectTrack }: TrackListingProps) {
  if (tracks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-[#55556a]">
        <Music className="h-12 w-12" />
        <p className="text-sm">No tracks in this view</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-[#0f0f11]">
          <TableRow className="border-[#2e2e36] hover:bg-transparent">
            <TableHead className="w-10 text-[#55556a]">#</TableHead>
            <TableHead className="text-[#55556a]">Title</TableHead>
            <TableHead className="text-[#55556a]">Artist</TableHead>
            <TableHead className="text-[#55556a]">Album</TableHead>
            <TableHead className="w-16 text-right text-[#55556a]">BPM</TableHead>
            <TableHead className="w-12 text-[#55556a]">Key</TableHead>
            <TableHead className="w-16 text-right text-[#55556a]">Time</TableHead>
            <TableHead className="text-[#55556a]">Genre</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tracks.map((track, index) => {
            const isSelected = track.id === selectedTrackId;
            return (
              <TableRow
                key={track.id}
                onClick={() => onSelectTrack(track)}
                className={cn(
                  'cursor-pointer border-[#1e1e24] transition-colors',
                  isSelected
                    ? 'bg-[#6c5ce7]/20 hover:bg-[#6c5ce7]/25'
                    : 'hover:bg-[#1a1a1f]',
                )}
              >
                <TableCell className="text-xs text-[#55556a]">{index + 1}</TableCell>
                <TableCell className={cn('font-medium', isSelected ? 'text-[#e8e8f0]' : 'text-[#e8e8f0]')}>
                  {track.title || '—'}
                </TableCell>
                <TableCell className="text-[#8888a0]">{track.artist || '—'}</TableCell>
                <TableCell className="text-[#55556a]">{track.album || '—'}</TableCell>
                <TableCell className="text-right text-xs tabular-nums text-[#8888a0]">
                  {track.bpm > 0 ? track.bpm.toFixed(1) : '—'}
                </TableCell>
                <TableCell className="text-xs text-[#8888a0]">{track.key || '—'}</TableCell>
                <TableCell className="text-right text-xs tabular-nums text-[#8888a0]">
                  {track.duration > 0 ? formatDuration(track.duration) : '—'}
                </TableCell>
                <TableCell className="text-xs text-[#55556a]">{track.genre || '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
