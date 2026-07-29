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

export function StreamGrid({ initialData = [] }: StreamGridProps) {
  /**
   * 1. DATA MAPPING
   * We map the Supabase rows to the StreamCard UI format.
   * We use 'item.host_profile' to match the joined data from our page.tsx query.
   */
  const [models, setModels] = React.useState<StreamCardModel[]>(
    initialData.map((item: any) => ({
      id: item.id ?? item.host,
      hostId: item.host,
      username: item.host_profile?.username || item.host,
      displayName: item.host_profile?.display_name ?? item.host_profile?.username ?? "Creator",
      title: item.title ?? "Live now",
      description: item.description ?? null,
      previewUrl: item.cover_image ?? item.media_url ?? null,
      region: "Live",
      viewers: stableViewerCount(`${item.host}-${item.id ?? ""}`),
      isLive: true,
      category: item.category,
    }))
  );
  React.useEffect(() => {
    setModels(
      initialData.map((item: any) => ({
        id: item.id ?? item.host,
        hostId: item.host,
        username: item.host_profile?.username || item.host,
        displayName: item.host_profile?.display_name ?? item.host_profile?.username ?? "Creator",
        title: item.title ?? "Live now",
        description: item.description ?? null,
        previewUrl: item.cover_image ?? item.media_url ?? null,
        region: "Live",
        viewers: stableViewerCount(`${item.host}-${item.id ?? ""}`),
        isLive: true,
        category: item.category,
      }))
    );
  }, [initialData]);

  // 3. EMPTY STATE
  // If no streams survive the filters, we return null so the 'No live rooms' 
  // message in page.tsx can take over the screen.
  if (models.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {models.map((m) => (
        <StreamCard 
          key={m.id}
          model={m} 
        />
      ))}
    </div>
  );
}