import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Profile = {
  id: string;
  role: string;
  username: string | null;
};

export default async function AgencyDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role,username")
    .eq("id", uid)
    .single();

  const p = profile as unknown as Profile | null;
  if (!p || (p.role !== "agency" && p.role !== "agency_master" && p.role !== "super_admin")) {
    redirect("/");
  }

  // Commission earned: sum 10% fee entries for orgs owned by agency.
  // Assumes you have `transactions.agency_fee` and `orgs.owner_id`.
  // If your schema differs, adjust queries accordingly.
  const { data: orgs } = await supabase
    .from("orgs")
    .select("id,name")
    .eq("owner_id", uid);

  const orgIds = (orgs ?? []).map((o: any) => o.id);

  const { data: txAgg } = orgIds.length
    ? await supabase
        .from("transactions")
        .select("agency_fee,metadata,created_at")
        .in("org_id", orgIds as any)
    : { data: [] as any[] };

  const totalCommission = (txAgg ?? []).reduce(
    (sum: number, r: any) => sum + (r.agency_fee ?? 0),
    0
  );

  // Managed hosts: org_members + their profile and live status placeholder.
  const { data: members } = orgIds.length
    ? await supabase
        .from("org_members")
        .select("org_id,user_id,member_role,profiles:profiles(id,username,role)")
        .in("org_id", orgIds as any)
    : { data: [] as any[] };

  return (
    <Shell>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Agency Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Welcome{p.username ? `, ${p.username}` : ""}. Track commissions and host activity.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card title="Total commission earned">
            <div className="text-3xl font-semibold tabular-nums">
              {totalCommission.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Sum of `transactions.agency_fee` for your orgs.
            </div>
          </Card>
          <Card title="Managed orgs">
            <div className="text-3xl font-semibold tabular-nums">
              {(orgs ?? []).length}
            </div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Guilds/studios owned by this account.
            </div>
          </Card>
          <Card title="Team PK invitations">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Placeholder logic: invitation system coming next.
            </div>
            <button className="mt-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white">
              Create Invitation (placeholder)
            </button>
          </Card>
        </div>

        <Card title="Managed hosts">
          <div className="mt-2 divide-y divide-black/5 dark:divide-white/10">
            {(members ?? []).length ? (
              (members ?? []).map((m: any) => (
                <div key={`${m.org_id}:${m.user_id}`} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {m.profiles?.username ?? m.user_id}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Org: {(orgs ?? []).find((o: any) => o.id === m.org_id)?.name ?? m.org_id}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-black/10 dark:border-white/10 px-2 py-1 text-xs">
                      Live status: TBD
                    </span>
                    <button className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.06]">
                      Invite to Team PK
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-sm text-zinc-600 dark:text-zinc-400">
                No hosts found under your orgs yet.
              </div>
            )}
          </div>
        </Card>
      </main>
    </Shell>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/30 backdrop-blur p-4 sm:p-5">
      <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {title}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

