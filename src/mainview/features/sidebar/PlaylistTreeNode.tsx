import { useState, useRef } from "react";
import type { PlaylistNode } from "../../../shared/types";
import { useDismissable } from "../../hooks/useDismissable";
import { ChevronRight, ChevronDown, Folder, ListMusic } from "lucide-react";

// Recursive sidebar node for the playlist tree, with a right-click
// "Analyze playlist" menu. Extracted from App.tsx.

export function PlaylistTreeNode({
  node,
  selectedId,
  onSelect,
  onAnalyzePlaylist,
}: {
  node: PlaylistNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAnalyzePlaylist: (playlistId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useDismissable(menuRef, () => setCtxMenu(null), { escape: false });

  if (node.isFolder) {
    return (
      <div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Folder size={14} />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children.length > 0 && (
          <div className="pl-4">
            {node.children.map((child) => (
              <PlaylistTreeNode
                key={child.id}
                node={child}
                selectedId={selectedId}
                onSelect={onSelect}
                onAnalyzePlaylist={onAnalyzePlaylist}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = node.id === selectedId;
  return (
    <div className="relative">
      <button
        onClick={() => onSelect(node.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
        className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors ${
          isSelected
            ? "bg-muted/50 text-foreground border-l-2 border-primary"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        }`}
      >
        <ListMusic size={14} className="shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
      {ctxMenu && (
        <div
          ref={menuRef}
          style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 1000 }}
          className="bg-card border border-border rounded-md shadow-lg py-1 min-w-[160px]"
        >
          <button
            onClick={() => { onAnalyzePlaylist(node.id); setCtxMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
          >
            Analyze playlist
          </button>
        </div>
      )}
    </div>
  );
}
