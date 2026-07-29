"use client";

import * as React from "react";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function PkProgressBar({
  leftLabel,
  rightLabel,
  leftScore,
  rightScore,
}: {
  leftLabel: string;
  rightLabel: string;
  leftScore: number;
  rightScore: number;
}) {
  const total = leftScore + rightScore;
  const leftPct = total <= 0 ? 0.5 : clamp01(leftScore / total);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
        <span className="font-medium">{leftLabel}</span>
        <span className="tabular-nums">
          {leftScore.toLocaleString()} : {rightScore.toLocaleString()}
        </span>
        <span className="font-medium">{rightLabel}</span>
      </div>
      <div className="mt-2 h-3 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 transition-[width] duration-300 ease-out"
          style={{ width: `${leftPct * 100}%` }}
        />
      </div>
    </div>
  );
}

