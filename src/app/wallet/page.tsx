import Link from "next/link";

export default function WalletPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-white">Wallet</h1>
        <p className="mt-1 text-xs sm:text-sm text-neutral-400">
          Token purchase history and payouts will live here.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-neutral-900/30 p-4 sm:p-6">
        <div className="text-sm font-semibold text-white">Buy tokens</div>
        <div className="mt-2 text-sm text-neutral-400">
          Use the header “Buy” button for the simulated purchase flow.
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/"
            className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-400 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Go to marketplace
          </Link>
          <Link
            href="/agency/dashboard"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white hover:bg-neutral-800 transition-colors"
          >
            Agency dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}