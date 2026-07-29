"use client";

import * as React from "react";
import Image from "next/image";
import { WalletHeader } from "@/components/wallet/WalletHeader";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-50">
      <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-white/60 px-4">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="NexusLive"
              width={140}
              height={50}
              className="h-auto w-[120px] sm:w-[140px]"
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </div>
          <WalletHeader />
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}

