import { useRef, useState } from "react";
import { useDismissable } from "../../hooks/useDismissable";
import { READINESS_TIER_LABELS, READINESS_TIER_ORDER, type ReadinessTier } from "../../../shared/systemReadiness";
import type { Track } from "../../../shared/types";

const TIER_COLOR: Record<ReadinessTier, string> = {
  bad: "bg-red-400",
  home: "bg-amber-400",
  big: "bg-green-400",
};

const ALL_TIERS: ReadinessTier[] = ["bad", "home", "big"];

function Bars({ tier }: { tier: ReadinessTier | null }) {
  const filled = tier != null ? READINESS_TIER_ORDER[tier] + 1 : 0;
  const color = tier != null ? TIER_COLOR[tier] : "bg-muted-foreground/30";
  return (
    <span className="inline-flex items-end gap-0.5 h-3.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-1 rounded-sm ${i < filled ? color : "bg-muted-foreground/20"}`}
          style={{ height: `${(i + 1) * 4 + 2}px` }}
        />
      ))}
      {tier == null && <span className="ml-1 text-[10px] text-muted-foreground">?</span>}
    </span>
  );
}

interface ReadinessMenuProps {
  pos: { x: number; y: number };
  track: Track;
  onSelect: (tier: ReadinessTier | null) => void;
  onClose: () => void;
}

function ReadinessMenu({ pos, track, onSelect, onClose }: ReadinessMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(ref, onClose);

  const derived = track.systemReadinessDerivedTier;
  const autoLabel = derived
    ? `Auto — ${READINESS_TIER_LABELS[derived]}${
        track.systemReadinessSourceBitrate != null ? ` (from ${track.systemReadinessSourceBitrate} kbps)` : ""
      }`
    : "Auto — unknown";

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 1001 }}
      className="bg-card border border-border rounded-md shadow-lg py-1 min-w-[200px]"
    >
      <button
        onClick={() => { onSelect(null); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left"
      >
        <span className="w-3.5 shrink-0">{!track.systemReadinessIsOverride && "✓"}</span>
        {autoLabel}
      </button>
      <div className="my-1 border-t border-border" />
      {ALL_TIERS.map((tier) => (
        <button
          key={tier}
          onClick={() => { onSelect(tier); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors text-left"
        >
          <span className="w-3.5 shrink-0">
            {track.systemReadinessIsOverride && track.systemReadiness === tier && "✓"}
          </span>
          <Bars tier={tier} />
          {READINESS_TIER_LABELS[tier]}
        </button>
      ))}
    </div>
  );
}

export function SystemReadinessCell({
  track,
  onSetOverride,
}: {
  track: Track;
  onSetOverride?: (trackId: string, tier: ReadinessTier | null) => void;
}) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setMenuPos({ x: rect.left, y: rect.bottom + 4 });
        }}
        className="flex flex-col items-start gap-0.5 cursor-pointer"
        title={track.systemReadinessIsOverride ? "Set by ear — click to change" : undefined}
      >
        <Bars tier={track.systemReadiness} />
        <span
          className={`h-0.5 w-full rounded-full ${track.systemReadinessIsOverride ? "bg-primary" : "bg-transparent"}`}
        />
      </button>
      {menuPos && onSetOverride && (
        <ReadinessMenu
          pos={menuPos}
          track={track}
          onSelect={(tier) => onSetOverride(track.id, tier)}
          onClose={() => setMenuPos(null)}
        />
      )}
    </div>
  );
}
