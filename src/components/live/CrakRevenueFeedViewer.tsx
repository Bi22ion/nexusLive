"use client";

import * as React from "react";
import { Zap, ExternalLink, Radio } from "lucide-react";

export default function CrakRevenueFeedViewer() {
  const widgetUrl =
    process.env.NEXT_PUBLIC_CRAKREVENUE_WIDGET_URL ||
    "https://t.frtayb.com/421947/3664/0?target=widgets&po=6533&aff_sub5=SF_0060G000004lmDN";

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header bar for the widget section */}
      <div className="flex items-center justify-between bg-neutral-900/60 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
            <Zap className="h-5 w-5 fill-red-500" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase italic tracking-tight text-white">Featured Global Cams</h2>
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Live interactive models streaming now</p>
          </div>
        </div>

        <a
          href={widgetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-lg shadow-red-600/20"
        >
          <span>Open Fullscreen</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Safe launch card — no iframe, avoids X-Frame-Options blocks */}
      <div className="w-full min-h-[400px] bg-gradient-to-br from-neutral-900 via-neutral-950 to-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative flex flex-col items-center justify-center p-8 text-center">
        <div className="relative mb-4">
          <div className="h-16 w-16 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-xl">
            <Radio className="h-8 w-8 animate-pulse" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-2">
          Live Cams Available
        </h3>
        <p className="text-xs text-neutral-400 max-w-md mb-6">
          Browse thousands of live interactive models. Click below to open the full cam directory in a new tab.
        </p>
        <a
          href={widgetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-600/30 transition transform hover:scale-105 active:scale-95"
        >
          <span>Browse Live Models</span>
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
