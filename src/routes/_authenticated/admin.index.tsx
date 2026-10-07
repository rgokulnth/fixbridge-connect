import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell, Empty, Pill, statusTone } from "@/components/app-shell";
import { adminNav } from "@/components/navs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminKyc, adminOverview, adminReleasePayment, signedUrls } from "@/lib/flow.functions";
import { money } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin dashboard — FixBridge" }, { name: "description", content: "Manage jobs, KYC and payouts." }] }),
  component: Admin,
});

function Admin() {
  const qc = useQueryClient();
  const load = useServerFn(adminOverview);
  const kyc = useServerFn(adminKyc);
  const release = useServerFn(adminReleasePayment);
  const sign = useServerFn(signedUrls);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin"], queryFn: () => load() });
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const view = async (path: string | null) => {
    if (!path) return;
    const { urls } = await sign({ data: { bucket: "kyc-docs", paths: [path] } });
    if (urls[0]) window.open(urls[0], "_blank");
  };

  return (
    <AppShell title="Admin" nav={adminNav}>
      <h1 className="mb-4 text-2xl font-bold">Admin dashboard</h1>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <Empty title="Admins only" hint={(error as Error).message} />}
      {data && (
        <Tabs defaultValue="kyc">
          <TabsList className="w-full rounded-2xl">
            <TabsTrigger value="kyc" className="flex-1">KYC</TabsTrigger>
            <TabsTrigger value="jobs" className="flex-1">Jobs</TabsTrigger>
            <TabsTrigger value="pay" className="flex-1">Payments</TabsTrigger>
            <TabsTrigger value="disp" className="flex-1">Disputes</TabsTrigger>
          </TabsList>
          <TabsContent value="kyc" className="space-y-3">
            {data.experts.length === 0 && <Empty title="No experts yet" />}
            {data.experts.map((e) => (
              <div key={e.id} className="card-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{e.name ?? "Unnamed"} <span className="text-xs text-muted-foreground">{e.phone}</span></p>
                  <Pill t={statusTone(e.kyc_status)}>{e.kyc_status}</Pill>
                </div>
                <p className="text-xs capitalize text-muted-foreground">{e.skills.join(", ")}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <button className="text-primary underline" onClick={() => view(e.aadhaar_path)}>Aadhaar</button>
                  <button className="text-primary underline" onClick={() => view(e.photo_path)}>Photo</button>
                </div>
                {e.kyc_status !== "Verified" && (
                  <div className="mt-3 flex gap-2">
                    <Button className="flex-1 rounded-2xl" onClick={() => act(() => kyc({ data: { expertId: e.id, approve: true } }), "Approved")}>Approve</Button>
                    <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => act(() => kyc({ data: { expertId: e.id, approve: false } }), "Rejected")}>Reject</Button>
                  </div>
                )}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="jobs">
            <div className="card-surface overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Problem</th><th className="p-3">Status</th><th className="p-3">Created</th></tr></thead>
                <tbody>
                  {data.jobs.map((j: any) => (
                    <tr key={j.id} className="border-b last:border-0">
                      <td className="p-3">{j.problems?.title}</td>
                      <td className="p-3"><Pill t={statusTone(j.status)}>{j.status}</Pill></td>
                      <td className="p-3 text-xs">{new Date(j.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.jobs.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No jobs yet</p>}
            </div>
          </TabsContent>
          <TabsContent value="pay" className="space-y-3">
            {data.payments.length === 0 && <Empty title="No payments yet" />}
            {data.payments.map((p) => (
              <div key={p.id} className="card-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{money(p.amount, p.currency)}</p>
                  <Pill t={statusTone(p.status)}>{p.status.replace(/_/g, " ")}</Pill>
                </div>
                <p className="text-xs text-muted-foreground">Expert gets 80%: {money(p.amount - p.commission, p.currency)} · Commission {money(p.commission, p.currency)}</p>
                {["Held_in_escrow", "Release_pending"].includes(p.status) && (
                  <Button className="mt-3 w-full rounded-2xl" onClick={() => act(() => release({ data: { paymentId: p.id } }), "80% released to expert")}>Release 80%</Button>
                )}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="disp" className="space-y-3">
            {data.disputes.length === 0 && <Empty title="No disputes" />}
            {data.disputes.map((d) => (
              <div key={d.id} className="card-surface p-4">
                <div className="flex justify-between"><Pill t={statusTone(d.status)}>{d.status}</Pill><span className="text-xs">{new Date(d.created_at).toLocaleDateString()}</span></div>
                <p className="mt-2 text-sm">{d.reason}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
