import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Empty, Pill, statusTone } from "@/components/app-shell";
import { expertNav } from "@/components/navs";
import { Button } from "@/components/ui/button";
import { expertSetJobStatus } from "@/lib/flow.functions";
import { money } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/e/jobs")({
  head: () => ({ meta: [{ title: "My jobs — FixBridge" }, { name: "description", content: "Your assigned jobs and sent quotes." }] }),
  component: MyJobs,
});

const NEXT: Record<string, { s: "On_the_way" | "Started" | "Solved"; l: string }> = {
  Assigned: { s: "On_the_way", l: "I'm on the way" },
  On_the_way: { s: "Started", l: "Start work" },
  Started: { s: "Solved", l: "Mark solved" },
};

function MyJobs() {
  const qc = useQueryClient();
  const setStatus = useServerFn(expertSetJobStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["e-jobs"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const [{ data: jobs }, { data: quotes }] = await Promise.all([
        supabase.from("jobs").select("*, problems(title,category), quotes(amount)").eq("expert_id", u.user!.id).order("created_at", { ascending: false }),
        supabase.from("quotes").select("id,amount,status,problems(title)").eq("expert_id", u.user!.id).eq("status", "Sent").order("created_at", { ascending: false }),
      ]);
      return { jobs: jobs ?? [], quotes: quotes ?? [] };
    },
  });

  return (
    <AppShell title="My jobs" nav={expertNav}>
      <h1 className="mb-4 text-2xl font-bold">My jobs</h1>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {data?.jobs.length === 0 && <Empty title="No jobs yet" hint="Send quotes on available jobs to get hired." />}
      <div className="space-y-3">
        {data?.jobs.map((j: any) => {
          const n = NEXT[j.status];
          return (
            <div key={j.id} className="card-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{j.problems?.title}</p>
                <Pill t={statusTone(j.status)}>{j.status.replace(/_/g, " ")}</Pill>
              </div>
              <p className="text-sm text-muted-foreground">{money(j.quotes?.amount)} · you get {money(Math.round((j.quotes?.amount ?? 0) * 0.8))}</p>
              <div className="mt-3 flex gap-2">
                <Button asChild variant="outline" className="h-11 flex-1 rounded-2xl"><Link to="/chat/$jobId" params={{ jobId: j.id }}><MessageCircle className="size-4" /> Chat</Link></Button>
                {n && (
                  <Button
                    className="h-11 flex-1 rounded-2xl"
                    onClick={async () => {
                      try {
                        await setStatus({ data: { jobId: j.id, status: n.s } });
                        toast.success("Updated");
                        qc.invalidateQueries({ queryKey: ["e-jobs"] });
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    {n.l}
                  </Button>
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
                <span>{q.problems?.title}</span><span className="font-semibold">{money(q.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
