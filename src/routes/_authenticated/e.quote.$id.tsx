import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { expertNav } from "@/components/navs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { splitDescription, useMe } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/e/quote/$id")({
  head: () => ({ meta: [{ title: "Send quote — FixBridge" }, { name: "description", content: "Quote your price for this job." }] }),
  component: SendQuote,
});

function SendQuote() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("1");
  const [materials, setMaterials] = useState("");
  const [warranty, setWarranty] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: p } = useQuery({ queryKey: ["prob-e", id], queryFn: async () => (await supabase.from("problems").select("description,location").eq("id", id).maybeSingle()).data });
  const { title, body } = splitDescription(p?.description);

  return (
    <AppShell title="Send quote" nav={expertNav}>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <form
        className="mt-5 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const { data: ex } = await supabase.from("experts").select("verification_status").eq("user_id", me!.user.id).maybeSingle();
            if (ex?.verification_status !== "approved") throw new Error("Your verification is not approved yet");
            const { error } = await supabase.from("quotes").insert({ problem_id: id, expert_id: me!.user.id, amount: Number(amount), days: Number(days), materials: materials || null, warranty: warranty || null, status: "sent" });
            if (error) throw error;
            await supabase.from("problems").update({ status: "quoted" }).eq("id", id).eq("status", "open");
            toast.success("Quote sent!");
            navigate({ to: "/e/jobs" });
          } catch (err: any) {
            toast.error(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div><Label>Amount (₹)</Label><Input required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-12 rounded-2xl" /></div>
        <div><Label>Days to complete</Label><Input required type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} className="mt-1 h-12 rounded-2xl" /></div>
        <div><Label>Materials</Label><Input value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="eg: PVC pipe, sealant" className="mt-1 h-12 rounded-2xl" /></div>
        <div><Label>Warranty</Label><Input value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="eg: 30 days" className="mt-1 h-12 rounded-2xl" /></div>
        <Button disabled={busy || !amount || !me} className="h-14 w-full rounded-2xl text-base">Send quote</Button>
      </form>
    </AppShell>
  );
}
