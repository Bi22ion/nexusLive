import { redirect } from "next/navigation";
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

  const { data: members } = orgIds.length
    ? await supabase
        .from("org_members")
        .select("org_id,user_id,member_role,profiles:profiles(id,username,role)")
        .in("org_id", orgIds as any)
    : { data: [] as any[] };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold uppercase tracking-tight text-white sm:text-2xl">
          Agency Dashboard
        </h1>
        <p className="mt-1 text-xs text-neutral-500">
          Welcome{p.username ? `, ${p.username}` : ""}. Track commissions and host activity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card title="Total commission earned">
          <div className="text-2xl font-bold tabular-nums text-white">
            {totalCommission.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">
            Sum of agency fees for your orgs
          </div>
        </Card>
        <Card title="Managed orgs">
          <div className="text-2xl font-bold tabular-nums text-white">
            {(orgs ?? []).length}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">
            Studios owned by this account
          </div>
        </Card>
        <Card title="Team PK invitations">
          <div className="text-[11px] text-neutral-500">
            Invitation system coming soon
          </div>
          <button className="mt-3 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90">
            Create Invitation
          </button>
        </Card>
      </div>

      <Card title="Managed hosts">
        <div className="divide-y divide-white/[0.04]">
          {(members ?? []).length ? (
            (members ?? []).map((m: any) => (
              <div
                key={`${m.org_id}:${m.user_id}`}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {m.profiles?.username ?? m.user_id}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Org: {(orgs ?? []).find((o: any) => o.id === m.org_id)?.name ?? m.org_id}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/[0.06] px-2 py-1 text-[11px] text-neutral-400">
                    Live status: TBD
                  </span>
                  <button className="rounded-full border border-white/[0.06] px-3 py-1.5 text-[11px] text-neutral-300 transition-colors hover:bg-white/[0.06]">
                    Invite to Team PK
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-sm text-neutral-500">
              No hosts found under your orgs yet.
            </div>
          )}
        </div>
      </Card>
    </main>
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
    <section className="rounded-2xl border border-white/[0.06] bg-neutral-900/40 p-4 sm:p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
        {title}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}
