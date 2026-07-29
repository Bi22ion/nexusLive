import { LiveArena } from "@/components/pk/LiveArena";

export default async function PkBattlePage({
  params,
}: {
  params: Promise<{ battleId: string }>;
}) {
  const { battleId } = await params;
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg sm:text-xl font-semibold">PK Battle</h1>
        <p className="mt-1 text-xs sm:text-sm text-neutral-400">
          Dual-stream arena with realtime progress.
        </p>
      </div>
      <LiveArena battleId={battleId} />
    </div>
  );
}

