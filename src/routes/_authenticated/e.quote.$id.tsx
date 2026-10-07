import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { expertNav } from "@/components/navs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { expertSendQuote } from "@/lib/flow.functions";

export const Route = createFileRoute("/_authenticated/e/quote/$id")({
  head: () => ({ meta: [{ title: "Send quote — FixBridge" }, { name: "description", content: "Quote your price for this job." }] }),
  component: SendQuote,
});

function SendQuote() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const send = useServerFn(expertSendQuote);
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("1");
  const [materials, setMaterials] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: p } = useQuery({ queryKey: ["prob-e", id], queryFn: async () => (await supabase.from("problems").select("title,description,category").eq("id", id).maybeSingle()).data });

  return (
    <AppShell title="Send quote" nav={expertNav}>
      <h1 className="text-2xl font-bold">{p?.title ?? "Send quote"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{p?.description}</p>
      <form
        className="mt-5 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await send({ data: { problemId: id, amount: Number(amount), days: Number(days), materials, description: note } });
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
        <div><Label>Materials</Label><Input value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="e.g. PVC pipe, sealant" className="mt-1 h-12 rounded-2xl" /></div>
        <div><Label>Note to customer</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 rounded-2xl" /></div>
        <Button disabled={busy || !amount} className="h-14 w-full rounded-2xl text-base">Send quote</Button>
      </form>
    </AppShell>
  );
}
