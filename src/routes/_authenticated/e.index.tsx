import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Empty, Pill } from "@/components/app-shell";
import { expertNav } from "@/components/navs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { splitDescription, useMe } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/e/")({
  head: () => ({ meta: [{ title: "Browse jobs — FixBridge" }, { name: "description", content: "Open problems waiting for your quote." }] }),
  component: Browse,
});

function Browse() {
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["browse", me?.user.id],
    enabled: !!me,
    queryFn: async () => {
      const { data: ex } = await supabase.from("experts").select("verification_status").eq("user_id", me!.user.id).maybeSingle();
      const status = ex?.verification_status ?? "none";
      if (status !== "approved") return { status, list: [] };
      const { data: list } = await supabase.from("problems").select("id,description,location,created_at,ai_analyses(problem_type,urgency)").in("status", ["open", "quoted"]).order("created_at", { ascending: false });
      return { status, list: list ?? [] };
    },
  });

  return (
    <AppShell title="Browse jobs" nav={expertNav}>
      <h1 className="mb-4 text-2xl font-bold">Browse jobs</h1>
      {isLoading && [0, 1].map((i) => <Skeleton key={i} className="mb-3 h-32 rounded-2xl" />)}
      {data?.status === "pending" && (
        <Empty title="Verification in progress ⏳" hint="Our team is checking your Aadhaar and photo. You'll be able to see and quote on jobs as soon as you're approved — usually within 24 hours." />
      )}
      {data && ["none", "rejected"].includes(data.status) && (
        <Empty title={data.status === "rejected" ? "Verification was rejected" : "Verify your identity first"} hint="Upload your Aadhaar and a photo to start receiving jobs.">
          <Button asChild className="mt-2 rounded-xl"><Link to="/e/onboarding">Start KYC</Link></Button>
        </Empty>
      )}
      {data?.status === "approved" && data.list.length === 0 && <Empty title="No open jobs right now" hint="New problems will show up here." />}
      <div className="space-y-3">
        {data?.list.map((p: any) => {
          const ai = Array.isArray(p.ai_analyses) ? p.ai_analyses[0] : p.ai_analyses;
          const { title, body } = splitDescription(p.description);
          return (
            <div key={p.id} className="card-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{title}</p>
                {ai?.urgency && <Pill t={ai.urgency === "high" ? "bad" : "muted"} className="capitalize">{ai.urgency}</Pill>}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {ai?.problem_type && <span className="capitalize">{ai.problem_type}</span>}
                {p.location && <span className="flex items-center gap-1"><MapPin className="size-3" /> {p.location}</span>}
                <span className="flex items-center gap-1"><Clock className="size-3" /> {new Date(p.created_at).toLocaleDateString()}</span>
              </p>
              {body && <p className="mt-2 line-clamp-2 text-sm">{body}</p>}
              <div className="mt-3 flex gap-2">
                <Button asChild variant="outline" className="h-11 flex-1 rounded-2xl"><Link to="/problems/$id" params={{ id: p.id }}>Details</Link></Button>
                <Button asChild className="h-11 flex-1 rounded-2xl"><Link to="/e/quote/$id" params={{ id: p.id }}>Send quote</Link></Button>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
