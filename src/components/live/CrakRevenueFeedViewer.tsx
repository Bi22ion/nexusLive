"use client";

import React from "react";
import { Zap, ExternalLink } from "lucide-react";

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

      {/* Iframe Feed Container */}
      <div className="w-full min-h-[750px] bg-neutral-950 rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
        <iframe
          src={widgetUrl}
          title="Live Models Feed"
          className="w-full h-full min-h-[750px] border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          loading="lazy"
        />
      </div>
    </div>
  );
}
