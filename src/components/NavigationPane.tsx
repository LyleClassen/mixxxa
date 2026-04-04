import { ChevronDown, ChevronRight, Library, ListMusic } from 'lucide-react';
import { useState } from 'react';
import type { NavNode, NavView } from '../types';
import { cn } from '../lib/utils';

interface NavigationPaneProps {
  navTree: NavNode[];
  selectedView: NavView;
  onSelectView: (view: NavView) => void;
}

export function NavigationPane({ navTree, selectedView, onSelectView }: NavigationPaneProps) {
  const isAllTracks = selectedView.kind === 'all';

  return (
    <nav className="flex h-full flex-col overflow-y-auto bg-[#0f0f11] border-r border-[#2e2e36]">
      <div className="p-3">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-[#55556a]">
          Library
        </p>

        <button
          type="button"
          onClick={() => onSelectView({ kind: 'all' })}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
            isAllTracks
              ? 'bg-[#6c5ce7]/15 text-[#e8e8f0] font-medium'
              : 'text-[#8888a0] hover:bg-[#1a1a1f] hover:text-[#e8e8f0]',
          )}
        >
          <Library className="h-4 w-4 flex-shrink-0" />
          All Tracks
        </button>
      </div>

      {navTree.length > 0 && (
        <div className="p-3 pt-0">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-[#55556a]">
            Playlists
          </p>
          {navTree.map((node) => (
            <NavNodeItem
              key={node.type === 'Folder' ? node.id : node.id}
              node={node}
              selectedView={selectedView}
              onSelectView={onSelectView}
              depth={0}
            />
          ))}
        </div>
      )}
    </nav>
  );
}

interface NavNodeItemProps {
  node: NavNode;
  selectedView: NavView;
  onSelectView: (view: NavView) => void;
  depth: number;
}

function NavNodeItem({ node, selectedView, onSelectView, depth }: NavNodeItemProps) {
  const [open, setOpen] = useState(depth === 0);

  if (node.type === 'Folder') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-[#8888a0] hover:bg-[#1a1a1f] hover:text-[#e8e8f0] transition-colors"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {open && (
          <div>
            {node.children.map((child) => (
              <NavNodeItem
                key={child.type === 'Folder' ? child.id : child.id}
                node={child}
                selectedView={selectedView}
                onSelectView={onSelectView}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Playlist leaf
  const isSelected =
    selectedView.kind === 'playlist' && selectedView.playlistId === node.id;

  return (
    <button
      type="button"
      onClick={() =>
        onSelectView({ kind: 'playlist', playlistId: node.id, name: node.name })
      }
      className={cn(
        'flex w-full items-center gap-2 rounded-md py-1.5 text-sm transition-colors',
        isSelected
          ? 'bg-[#6c5ce7]/15 text-[#e8e8f0] font-medium'
          : 'text-[#8888a0] hover:bg-[#1a1a1f] hover:text-[#e8e8f0]',
      )}
      style={{ paddingLeft: `${8 + (depth + 1) * 12}px`, paddingRight: '8px' }}
    >
      <ListMusic className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
