"use client";

import * as React from "react";
import { StreamCard, type StreamCardModel } from "@/components/market/StreamCard";

interface StreamGridProps {
  initialData?: any[];
}

function stableViewerCount(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return 120 + (hash % 500);
}

function mapRow(item: any): StreamCardModel {
  const profile = item.host_profile && !Array.isArray(item.host_profile)
    ? item.host_profile
    : Array.isArray(item.host_profile)
      ? item.host_profile[0]
      : null;

  return {
    id: item.id ?? item.host,
    hostId: item.host,
    streamId: item.id,
    username: profile?.username || item.host,
    displayName: profile?.display_name ?? profile?.username ?? "Creator",
    title: item.title ?? "Live now",
    description: item.description ?? null,
    previewUrl: item.cover_image ?? item.media_url ?? null,
    region: "Live",
    viewers: stableViewerCount(`${item.host}-${item.id ?? ""}`),
    isLive: item.status === "live",
    category: item.category ?? null,
  };
}

export function StreamGrid({ initialData = [] }: StreamGridProps) {
  const [models, setModels] = React.useState<StreamCardModel[]>(
    initialData.map(mapRow)
  );

  React.useEffect(() => {
    setModels(initialData.map(mapRow));
  }, [initialData]);

  if (models.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {models.map((m) => (
        <StreamCard key={m.id} model={m} />
      ))}
    </div>
  );
}
