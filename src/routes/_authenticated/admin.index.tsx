import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Empty, Pill, statusTone } from "@/components/app-shell";
import { adminNav } from "@/components/navs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { label, money, splitDescription } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin dashboard — FixBridge" }, { name: "description", content: "Manage experts, jobs, payments and disputes." }] }),
  component: Admin,
});

function Admin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin"],
    queryFn: async () => {
      const [experts, problems, jobs, payments, disputes, profiles] = await Promise.all([
        supabase.from("experts").select("*").order("created_at", { ascending: false }),
        supabase.from("problems").select("id,description,status,location,created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("jobs").select("id,status,created_at,problems(description)").order("created_at", { ascending: false }).limit(200),
        supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("disputes").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("profiles").select("id,name,phone"),
      ]);
      return { experts: experts.data ?? [], problems: problems.data ?? [], jobs: jobs.data ?? [], payments: payments.data ?? [], disputes: disputes.data ?? [], profiles: profiles.data ?? [] };
    },
  });
  const act = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await p;
    if (error) return void toast.error(error.message);
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["admin"] });
  };
  const fileUrl = (path: string | null) => (path ? supabase.storage.from("problem-images").getPublicUrl(path).data.publicUrl : null);
  const pending = data?.experts.filter((e) => e.verification_status === "pending") ?? [];

  return (
    <AppShell title="Admin" nav={adminNav}>
      <h1 className="mb-4 text-2xl font-bold">Admin dashboard</h1>
      {isLoading && <Skeleton className="h-48 rounded-2xl" />}
      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Pending KYC", pending.length], ["Problems", data.problems.length], ["Jobs", data.jobs.length], ["Open disputes", data.disputes.filter((d) => d.status !== "resolved").length]].map(([l, v]) => (
              <div key={l} className="card-surface p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="font-display text-2xl font-bold">{v}</p></div>
            ))}
          </div>
          <Tabs defaultValue="kyc">
            <TabsList className="w-full overflow-x-auto rounded-2xl">
              <TabsTrigger value="kyc" className="flex-1">KYC</TabsTrigger>
              <TabsTrigger value="problems" className="flex-1">Problems</TabsTrigger>
              <TabsTrigger value="jobs" className="flex-1">Jobs</TabsTrigger>
              <TabsTrigger value="pay" className="flex-1">Payments</TabsTrigger>
              <TabsTrigger value="disp" className="flex-1">Disputes</TabsTrigger>
            </TabsList>
            <TabsContent value="kyc" className="space-y-3">
              {pending.length === 0 && <Empty title="No experts waiting" hint="New KYC submissions will appear here." />}
              {pending.map((e) => {
                const pr = data.profiles.find((x) => x.id === e.user_id);
                return (
                  <div key={e.id} className="card-surface p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{pr?.name ?? "Unnamed"} <span className="text-xs text-muted-foreground">{pr?.phone}</span></p>
                      <Pill t="warn">Pending</Pill>
                    </div>
                    <p className="text-xs capitalize text-muted-foreground">{e.skill ?? "—"}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      {[["Aadhaar front", e.aadhaar_front], ["Aadhaar back", e.aadhaar_back], ["Photo", e.photo]].map(([l, p]) =>
                        p ? <a key={l} href={fileUrl(p)!} target="_blank" rel="noreferrer" className="text-primary underline">{l}</a> : null,
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button className="flex-1 rounded-2xl" onClick={() => act(supabase.from("experts").update({ verification_status: "approved" }).eq("id", e.id), "Expert approved")}>Approve</Button>
                      <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => act(supabase.from("experts").update({ verification_status: "rejected" }).eq("id", e.id), "Expert rejected")}>Reject</Button>
                    </div>
                  </div>
                );
              })}
            </TabsContent>
            <TabsContent value="problems">
              <Table head={["Problem", "Location", "Status"]} rows={data.problems.map((p) => [splitDescription(p.description).title, p.location ?? "—", <Pill key="s" t={statusTone(p.status)}>{label(p.status)}</Pill>])} />
            </TabsContent>
            <TabsContent value="jobs">
              <Table head={["Job", "Status", "Created"]} rows={data.jobs.map((j: any) => [splitDescription(j.problems?.description).title, <Pill key="s" t={statusTone(j.status)}>{label(j.status)}</Pill>, new Date(j.created_at).toLocaleDateString()])} />
            </TabsContent>
            <TabsContent value="pay" className="space-y-3">
              {data.payments.length === 0 && <Empty title="No payments yet" />}
              {data.payments.map((p) => (
                <div key={p.id} className="card-surface p-4">
                  <div className="flex items-center justify-between"><p className="font-semibold">{money(p.amount)}</p><Pill t={statusTone(p.status)}>{label(p.status)}</Pill></div>
                  <p className="text-xs text-muted-foreground">Expert gets 80%: {money(Math.round((p.amount ?? 0) * 0.8))} · FixBridge fee {money(Math.round((p.amount ?? 0) * 0.2))}</p>
                  {["completed", "release_pending", "held"].includes(p.status ?? "") && (
                    <Button className="mt-3 w-full rounded-2xl" onClick={async () => {
                      await act(supabase.from("payments").update({ status: "released" }).eq("id", p.id), "80% released to expert");
                      if (p.job_id) await supabase.from("jobs").update({ status: "completed" }).eq("id", p.job_id);
                    }}>Release 80%</Button>
                  )}
                </div>
              ))}
            </TabsContent>
            <TabsContent value="disp" className="space-y-3">
              {data.disputes.length === 0 && <Empty title="No disputes" hint="Great — everyone's happy." />}
              {data.disputes.map((d) => (
                <div key={d.id} className="card-surface p-4">
                  <div className="flex justify-between"><Pill t={d.status === "resolved" ? "good" : "bad"}>{d.status ?? "open"}</Pill><span className="text-xs">{d.created_at ? new Date(d.created_at).toLocaleDateString() : ""}</span></div>
                  <p className="mt-2 text-sm">{d.reason}</p>
                  {d.status !== "resolved" && <Button variant="outline" className="mt-3 w-full rounded-2xl" onClick={() => act(supabase.from("disputes").update({ status: "resolved" }).eq("id", d.id), "Marked resolved")}>Mark resolved</Button>}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppShell>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="card-surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-muted-foreground">{head.map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b last:border-0">{r.map((c, j) => <td key={j} className="p-3">{c}</td>)}</tr>)}</tbody>
      </table>
      {rows.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Nothing here yet</p>}
    </div>
  );
}
