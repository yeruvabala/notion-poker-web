// components/SuitsRow.tsx
import React from "react";

/** A perfectly symmetric set of suit icons (black). */
export default function SuitsRow({
  size = 72,
  gap = 28,
  className = "",
}: {
  size?: number;   // px per icon
  gap?: number;    // px between icons
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap,
      }}
    >
      <Spade size={size} />
      <Heart size={size} />
      <Club size={size} />
      <Diamond size={size} />
    </div>
  );
}

/** All icons share the same 100x100 viewBox so proportions match exactly. */
function Spade({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="spade">
      {/* leaf: symmetric inverted heart (two circles + top triangle) */}
      <g fill="currentColor">
        <circle cx="35" cy="35" r="22" />
        <circle cx="65" cy="35" r="22" />
        <polygon points="18,44 82,44 50,70" />
        {/* stem */}
        <polygon points="45,72 55,72 60,88 40,88" />
      </g>
    </svg>
  );
}

function Heart({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="heart">
      {/* two circles + bottom diamond point -> symmetric heart */}
      <g fill="currentColor">
        <circle cx="35" cy="35" r="22" />
        <circle cx="65" cy="35" r="22" />
        <polygon points="18,42 82,42 50,78" />
      </g>
    </svg>
  );
}

function Club({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="club">
      {/* three equal circles arranged symmetrically + centered stem */}
      <g fill="currentColor">
        <circle cx="50" cy="30" r="18" />
        <circle cx="30" cy="52" r="18" />
        <circle cx="70" cy="52" r="18" />
        {/* stem (centered) */}
        <polygon points="46,54 54,54 58,86 42,86" />
      </g>
    </svg>
  );
}

function Diamond({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="diamond">
      {/* perfect rotated square (diamond) */}
      <rect
        x="30"
        y="30"
        width="40"
        height="40"
        fill="currentColor"
        transform="rotate(45 50 50)"
      />
    </svg>
  );
}
