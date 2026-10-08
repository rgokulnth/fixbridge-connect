import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Brain, Check, MapPin, MessageCircle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Empty, Pill, statusTone } from "@/components/app-shell";
import { customerNav, expertNav } from "@/components/navs";
import { label, money, splitDescription, useMe } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/problems/$id")({
  head: () => ({ meta: [{ title: "Problem details — FixBridge" }, { name: "description", content: "AI suggestion, quotes and job tracking." }] }),
  component: ProblemDetail,
});

const STEPS = [
  { k: "assigned", l: "Expert assigned" },
  { k: "on_the_way", l: "On the way" },
  { k: "started", l: "Work started" },
  { k: "solved", l: "Solved" },
  { k: "confirmed", l: "You confirmed" },
  { k: "completed", l: "Payment released" },
];

function ProblemDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useMe();
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
        supabase.from("ai_analyses").select("*").eq("problem_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("quotes").select("*").eq("problem_id", id).order("amount"),
        supabase.from("jobs").select("*").eq("problem_id", id).maybeSingle(),
      ]);
      const ids = [...new Set((quotes ?? []).map((q) => q.expert_id).filter(Boolean) as string[])];
      const { data: experts } = ids.length ? await supabase.from("profiles").select("id,name").in("id", ids) : { data: [] as { id: string; name: string | null }[] };
      const { data: ratingRows } = ids.length ? await supabase.from("ratings").select("to_user,stars").in("to_user", ids) : { data: [] as { to_user: string | null; stars: number | null }[] };
      let payment = null, rated = false;
      if (job) {
        payment = (await supabase.from("payments").select("*").eq("job_id", job.id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
        rated = !!(await supabase.from("ratings").select("id").eq("job_id", job.id).maybeSingle()).data;
      }
      return { p, ai, quotes: quotes ?? [], experts: experts ?? [], ratingRows: ratingRows ?? [], job, payment, rated };
    },
  });

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  const must = <T,>(r: { error: { message: string } | null; data?: T }) => {
    if (r.error) throw new Error(r.error.message);
    return r.data as T;
  };

  const nav = me?.role === "expert" ? expertNav : customerNav;
  if (isLoading) return <AppShell title="Problem" nav={nav}><Skeleton className="h-40 rounded-2xl" /></AppShell>;
  if (!data) return <AppShell title="Problem" nav={nav}><Empty title="Problem not found" /></AppShell>;
  const { p, ai, quotes, experts, ratingRows, job, payment, rated } = data;
  const { title, body } = splitDescription(p.description);
  const isOwner = me?.user.id === p.customer_id;
  const stepIdx = job ? STEPS.findIndex((s) => s.k === job.status) : -1;
  const paid = !!payment;

  const acceptQuote = (q: (typeof quotes)[number]) =>
    run(async () => {
      const j = must<{ id: string }>(await supabase.from("jobs").insert({ problem_id: p.id, quote_id: q.id, expert_id: q.expert_id, customer_id: p.customer_id, status: "assigned" }).select("id").single());
      must(await supabase.from("chats").insert({ job_id: j.id, customer_id: p.customer_id, expert_id: q.expert_id }));
      await supabase.from("quotes").update({ status: "accepted" }).eq("id", q.id);
      await supabase.from("quotes").update({ status: "rejected" }).eq("problem_id", p.id).neq("id", q.id);
      await supabase.from("problems").update({ status: "assigned" }).eq("id", p.id);
    }, "Quote accepted! Pay to confirm your booking.");

  return (
    <AppShell title={title} nav={nav}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {p.location && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" /> {p.location}</p>}
        </div>
        <Pill t={statusTone(p.status)}>{label(p.status)}</Pill>
      </div>
      {body && <p className="mt-3 text-sm">{body}</p>}
      {!!p.photos?.length && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {p.photos.map((u) => <img key={u} src={u} alt="Problem" className="size-24 shrink-0 rounded-2xl object-cover" />)}
        </div>
      )}
      {(p.video || p.voice_note) && (
        <div className="mt-3 space-y-2">
          {p.video && <video src={p.video} controls className="w-full rounded-2xl" />}
          {p.voice_note && <audio src={p.voice_note} controls className="w-full" />}
        </div>
      )}

      {ai && (
        <section className="card-surface mt-5 p-4">
          <h2 className="flex items-center gap-2 font-bold"><Brain className="size-4 text-primary" /> AI suggestion</h2>
          <div className="mt-2 flex gap-2">
            {ai.problem_type && <Pill t="brand" className="capitalize">{ai.problem_type}</Pill>}
            {ai.urgency && <Pill t={ai.urgency === "high" ? "bad" : "muted"} className="capitalize">{ai.urgency} urgency</Pill>}
          </div>
          {ai.suggestion && <p className="mt-2 text-sm text-muted-foreground">{ai.suggestion}</p>}
        </section>
      )}

      {job ? (
        <section className="card-surface mt-5 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Job tracking</h2>
            <Pill t={paid ? "good" : "warn"}>{paid ? `Paid · ${label(payment!.status)}` : "Payment due"}</Pill>
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
          {job.status === "disputed" && <p className="mt-3 text-sm font-semibold text-destructive">Dispute raised — our team will review it.</p>}
          <div className="mt-4 grid gap-2">
            <Button asChild variant="outline" className="h-12 rounded-2xl"><Link to="/chat/$jobId" params={{ jobId: job.id }}><MessageCircle className="size-4" /> Open chat</Link></Button>
            {isOwner && !paid && (
              <Button disabled={busy} className="h-12 rounded-2xl" onClick={() => {
                const q = quotes.find((x) => x.id === job.quote_id);
                run(async () => { must(await supabase.from("payments").insert({ job_id: job.id, amount: q?.amount ?? 0, status: "completed" })); }, "Payment successful (demo) — held safely until you confirm.");
              }}>
                Pay {money(quotes.find((x) => x.id === job.quote_id)?.amount)} (demo)
              </Button>
            )}
            {isOwner && job.status === "solved" && (
              <Button disabled={busy} className="h-12 rounded-2xl" onClick={() => run(async () => {
                await supabase.from("jobs").update({ status: "confirmed" }).eq("id", job.id);
                if (payment) await supabase.from("payments").update({ status: "release_pending" }).eq("id", payment.id);
              }, "Confirmed! Payment will be released to your expert.")}>Confirm job done</Button>
            )}
            {isOwner && ["confirmed", "completed"].includes(job.status ?? "") && !rated && (
              <div className="rounded-2xl bg-secondary p-3">
                <p className="text-sm font-semibold">Rate your expert</p>
                <div className="my-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`}>
                      <Star className={cn("size-7", n <= stars ? "fill-primary text-primary" : "text-muted-foreground")} />
                    </button>
                  ))}
                </div>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was the work? (optional)" className="rounded-xl bg-card" />
                <Button disabled={busy} className="mt-2 w-full rounded-xl" onClick={() => run(async () => { must(await supabase.from("ratings").insert({ job_id: job.id, from_user: me!.user.id, to_user: job.expert_id, stars, comment: comment || null })); }, "Thanks for rating!")}>Submit rating</Button>
              </div>
            )}
            {isOwner && !["completed", "disputed"].includes(job.status ?? "") && (showDispute ? (
              <div className="rounded-2xl border p-3">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What went wrong?" className="rounded-xl" />
                <Button variant="destructive" disabled={busy || reason.length < 5} className="mt-2 w-full rounded-xl" onClick={() => run(async () => {
                  must(await supabase.from("disputes").insert({ job_id: job.id, raised_by: me!.user.id, reason, status: "open" }));
                  await supabase.from("jobs").update({ status: "disputed" }).eq("id", job.id);
                  await supabase.from("problems").update({ status: "disputed" }).eq("id", p.id);
                }, "Dispute raised")}>Submit dispute</Button>
              </div>
            ) : (
              <Button variant="ghost" className="text-destructive" onClick={() => setShowDispute(true)}>Raise a dispute</Button>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-6">
          <h2 className="text-lg font-bold">Quotes ({quotes.length})</h2>
          {quotes.length === 0 && <Empty title="Waiting for quotes" hint="Verified experts nearby have been notified. Quotes usually arrive within 15 minutes." />}
          <div className="mt-3 space-y-3">
            {quotes.map((q) => {
              const ex = experts.find((x) => x.id === q.expert_id);
              const rs = ratingRows.filter((r) => r.to_user === q.expert_id);
              const avg = rs.length ? rs.reduce((s, r) => s + (r.stars ?? 0), 0) / rs.length : 0;
              return (
                <div key={q.id} className="card-surface p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-full bg-accent font-bold text-accent-foreground">{(ex?.name ?? "E")[0]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{ex?.name ?? "Expert"}</p>
                      <p className="text-xs text-muted-foreground">★ {avg ? avg.toFixed(1) : "New"} ({rs.length}) · {q.days ?? "?"} days</p>
                    </div>
                    <p className="text-lg font-bold text-primary">{money(q.amount)}</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Materials: {q.materials || "—"}{q.warranty ? ` · Warranty: ${q.warranty}` : ""}</p>
                  {isOwner && (!q.status || q.status === "sent") ? (
                    <Button disabled={busy} className="mt-3 h-12 w-full rounded-2xl" onClick={() => acceptQuote(q)}>Accept quote</Button>
                  ) : (
                    q.status && <Pill t={statusTone(q.status)} className="mt-2 capitalize">{q.status}</Pill>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </AppShell>
  );
}
