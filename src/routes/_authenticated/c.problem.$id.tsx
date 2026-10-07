import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Brain, Check, MessageCircle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Empty, Pill, statusTone } from "@/components/app-shell";
import { customerNav } from "@/components/navs";
import { STATUS_LABEL, money } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { acceptQuoteHold, customerConfirmJob, customerDispute, customerRate, signedUrls } from "@/lib/flow.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/c/problem/$id")({
  head: () => ({ meta: [{ title: "Problem details — FixBridge" }, { name: "description", content: "AI diagnosis, quotes and job tracking." }] }),
  component: ProblemDetail,
});

const STEPS = [
  { k: "Assigned", l: "Expert assigned" },
  { k: "On_the_way", l: "On the way" },
  { k: "Started", l: "Work started" },
  { k: "Solved", l: "Solved" },
  { k: "Confirmed", l: "You confirmed" },
  { k: "Completed", l: "Payment released" },
];

function ProblemDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const accept = useServerFn(acceptQuoteHold);
  const confirm = useServerFn(customerConfirmJob);
  const dispute = useServerFn(customerDispute);
  const rate = useServerFn(customerRate);
  const sign = useServerFn(signedUrls);
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["problem", id],
    queryFn: async () => {
      const { data: p } = await supabase.from("problems").select("*").eq("id", id).maybeSingle();
      if (!p) return null;
      const [{ data: ai }, { data: quotes }, { data: job }] = await Promise.all([
        supabase.from("ai_analyses").select("*").eq("problem_id", id).maybeSingle(),
        supabase.from("quotes").select("*").eq("problem_id", id).order("amount"),
        supabase.from("jobs").select("*").eq("problem_id", id).maybeSingle(),
      ]);
      const ids = [...new Set((quotes ?? []).map((q) => q.expert_id))];
      const { data: cards } = ids.length ? await supabase.rpc("expert_cards", { _ids: ids }) : { data: [] as any[] };
      let payment = null, rated = false;
      if (job) {
        payment = (await supabase.from("payments").select("*").eq("job_id", job.id).maybeSingle()).data;
        rated = !!(await supabase.from("ratings").select("id").eq("job_id", job.id).maybeSingle()).data;
      }
      return { p, ai, quotes: quotes ?? [], cards: cards ?? [], job, payment, rated };
    },
  });
  const { data: media } = useQuery({
    queryKey: ["media", id, data?.p.media_urls],
    enabled: !!data?.p.media_urls?.length,
    queryFn: async () => (await sign({ data: { bucket: "problem-media", paths: data!.p.media_urls } })).urls,
  });

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["problem", id] });
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <AppShell title="Problem" nav={customerNav}><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!data) return <AppShell title="Problem" nav={customerNav}><Empty title="Problem not found" /></AppShell>;
  const { p, ai, quotes, cards, job, payment, rated } = data;
  const stepIdx = job ? Math.max(0, STEPS.findIndex((s) => s.k === job.status)) : -1;

  return (
    <AppShell title={p.title} nav={customerNav}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{p.title}</h1>
          <p className="text-sm capitalize text-muted-foreground">{p.category} · {p.urgency} urgency</p>
        </div>
        <Pill t={statusTone(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Pill>
      </div>
      <p className="mt-3 text-sm">{p.description}</p>
      {!!media?.length && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {media.map((u) => <img key={u} src={u} alt="Problem" className="size-24 shrink-0 rounded-2xl object-cover" />)}
        </div>
      )}

      {ai && (
        <section className="card-surface mt-5 p-4">
          <h2 className="flex items-center gap-2 font-bold"><Brain className="size-4 text-primary" /> AI diagnosis</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Root cause</dt><dd>{ai.root_cause ?? "—"}</dd>
            <dt className="text-muted-foreground">Skill</dt><dd className="capitalize">{ai.required_skill ?? "—"}</dd>
            <dt className="text-muted-foreground">Difficulty</dt><dd>{ai.difficulty ?? "—"}</dd>
            <dt className="text-muted-foreground">Est. cost</dt><dd>{money(ai.estimated_cost)}</dd>
          </dl>
          {ai.safety_notes && <p className="mt-2 rounded-xl bg-secondary p-2 text-xs">⚠️ {ai.safety_notes}</p>}
        </section>
      )}

      {job ? (
        <section className="card-surface mt-5 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Job tracking</h2>
            {payment && <Pill t={statusTone(payment.status)}>{payment.status.replace(/_/g, " ")}</Pill>}
          </div>
          <ol className="mt-4 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.k} className="flex items-center gap-3">
                <span className={cn("grid size-7 place-items-center rounded-full text-xs font-bold", i <= stepIdx ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                  {i <= stepIdx ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={cn("text-sm", i <= stepIdx ? "font-semibold" : "text-muted-foreground")}>{s.l}</span>
              </li>
            ))}
          </ol>
          {job.status === "Disputed" && <p className="mt-3 text-sm font-semibold text-destructive">Dispute raised — admin will review.</p>}
          <div className="mt-4 grid gap-2">
            <Button asChild variant="outline" className="h-12 rounded-2xl"><Link to="/chat/$jobId" params={{ jobId: job.id }}><MessageCircle className="size-4" /> Chat with expert</Link></Button>
            {job.status === "Solved" && (
              <Button disabled={busy} className="h-12 rounded-2xl" onClick={() => run(() => confirm({ data: { jobId: job.id } }), "Confirmed! Payment will be released.")}>
                Confirm job done
              </Button>
            )}
            {["Confirmed", "Completed"].includes(job.status) && !rated && (
              <div className="rounded-2xl bg-secondary p-3">
                <p className="text-sm font-semibold">Rate your expert</p>
                <div className="my-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`}>
                      <Star className={cn("size-7", n <= stars ? "fill-primary text-primary" : "text-muted-foreground")} />
                    </button>
                  ))}
                </div>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" className="rounded-xl bg-card" />
                <Button disabled={busy} className="mt-2 w-full rounded-xl" onClick={() => run(() => rate({ data: { jobId: job.id, stars, comment } }), "Thanks for rating!")}>Submit rating</Button>
              </div>
            )}
            {!["Completed", "Refunded", "Disputed"].includes(job.status) && (
              showDispute ? (
                <div className="rounded-2xl border p-3">
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What went wrong?" className="rounded-xl" />
                  <Button variant="destructive" disabled={busy || reason.length < 5} className="mt-2 w-full rounded-xl" onClick={() => run(() => dispute({ data: { jobId: job.id, reason } }), "Dispute raised")}>Submit dispute</Button>
                </div>
              ) : (
                <Button variant="ghost" className="text-destructive" onClick={() => setShowDispute(true)}>Raise a dispute</Button>
              )
            )}
          </div>
        </section>
      ) : (
        <section className="mt-6">
          <h2 className="text-lg font-bold">Quotes ({quotes.length})</h2>
          {quotes.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Waiting for experts to send quotes…</p>}
          <div className="mt-3 space-y-3">
            {quotes.map((q) => {
              const c = cards.find((x: any) => x.id === q.expert_id);
              return (
                <div key={q.id} className="card-surface p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-full bg-accent font-bold text-accent-foreground">{(c?.name ?? "E")[0]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{c?.name ?? "Expert"} {c?.kyc_status === "Verified" && <Pill t="good">Verified</Pill>}</p>
                      <p className="text-xs text-muted-foreground">★ {Number(c?.rating ?? 0).toFixed(1)} ({c?.rating_count ?? 0}) · {(c?.skills ?? []).join(", ")}</p>
                    </div>
                    <p className="text-lg font-bold text-primary">{money(q.amount)}</p>
                  </div>
                  <p className="mt-2 text-sm">{q.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{q.days ?? "?"} days · Materials: {q.materials ?? "—"}</p>
                  {q.status === "Sent" && (
                    <Button disabled={busy} className="mt-3 h-12 w-full rounded-2xl" onClick={() => run(() => accept({ data: { quoteId: q.id } }), "Quote accepted · payment held in escrow")}>
                      Accept & pay {money(q.amount)}
                    </Button>
                  )}
                  {q.status !== "Sent" && <Pill t={statusTone(q.status)} className="mt-2">{q.status}</Pill>}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Payment gateway is a placeholder — money is marked as held in escrow.</p>
        </section>
      )}
    </AppShell>
  );
}
