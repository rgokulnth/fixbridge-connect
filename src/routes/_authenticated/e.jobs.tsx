import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Empty, Pill, statusTone } from "@/components/app-shell";
import { expertNav } from "@/components/navs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { label, money, splitDescription, useMe } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/e/jobs")({
  head: () => ({ meta: [{ title: "My jobs — FixBridge" }, { name: "description", content: "Your assigned jobs and sent quotes." }] }),
  component: MyJobs,
});

const NEXT: Record<string, { s: string; l: string }> = {
  assigned: { s: "on_the_way", l: "I'm on the way" },
  on_the_way: { s: "started", l: "Start work" },
  started: { s: "solved", l: "Mark job complete" },
};

function MyJobs() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["e-jobs", me?.user.id],
    enabled: !!me,
    queryFn: async () => {
      const [{ data: jobs }, { data: quotes }] = await Promise.all([
        supabase.from("jobs").select("*, problems(description), quotes(amount)").eq("expert_id", me!.user.id).order("created_at", { ascending: false }),
        supabase.from("quotes").select("id,amount,status,problems(description)").eq("expert_id", me!.user.id).eq("status", "sent").order("created_at", { ascending: false }),
      ]);
      return { jobs: jobs ?? [], quotes: quotes ?? [] };
    },
  });

  return (
    <AppShell title="My jobs" nav={expertNav}>
      <h1 className="mb-4 text-2xl font-bold">My jobs</h1>
      {isLoading && [0, 1].map((i) => <Skeleton key={i} className="mb-3 h-28 rounded-2xl" />)}
      {data?.jobs.length === 0 && <Empty title="No jobs yet" hint="Send quotes on open problems to get hired." />}
      <div className="space-y-3">
        {data?.jobs.map((j: any) => {
          const n = NEXT[j.status ?? ""];
          return (
            <div key={j.id} className="card-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <Link to="/problems/$id" params={{ id: j.problem_id }} className="font-semibold">{splitDescription(j.problems?.description).title}</Link>
                <Pill t={statusTone(j.status)}>{label(j.status)}</Pill>
              </div>
              <p className="text-sm text-muted-foreground">{money(j.quotes?.amount)} · you get {money(Math.round((j.quotes?.amount ?? 0) * 0.8))}</p>
              <div className="mt-3 flex gap-2">
                <Button asChild variant="outline" className="h-11 flex-1 rounded-2xl"><Link to="/chat/$jobId" params={{ jobId: j.id }}><MessageCircle className="size-4" /> Chat</Link></Button>
                {n && (
                  <Button className="h-11 flex-1 rounded-2xl" onClick={async () => {
                    const { error } = await supabase.from("jobs").update({ status: n.s }).eq("id", j.id);
                    if (error) return void toast.error(error.message);
                    if (n.s === "solved") await supabase.from("problems").update({ status: "solved" }).eq("id", j.problem_id);
                    toast.success("Updated");
                    qc.invalidateQueries({ queryKey: ["e-jobs"] });
                  }}>{n.l}</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!!data?.quotes.length && (
        <>
          <h2 className="mb-2 mt-6 text-lg font-bold">Pending quotes</h2>
          <div className="space-y-2">
            {data.quotes.map((q: any) => (
              <div key={q.id} className="card-surface flex items-center justify-between p-3 text-sm">
                <span className="truncate">{splitDescription(q.problems?.description).title}</span><span className="font-semibold">{money(q.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
