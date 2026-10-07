import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Empty, Pill } from "@/components/app-shell";
import { expertNav } from "@/components/navs";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/e/")({
  head: () => ({ meta: [{ title: "Available jobs — FixBridge" }, { name: "description", content: "Open problems near you waiting for quotes." }] }),
  component: Available,
});

function Available() {
  const { data, isLoading } = useQuery({
    queryKey: ["available"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: ex } = await supabase.from("experts").select("kyc_status").eq("id", u.user!.id).maybeSingle();
      if (ex?.kyc_status !== "Verified") return { verified: false as const, status: ex?.kyc_status ?? "Not_started", list: [] };
      const { data: list } = await supabase
        .from("problems")
        .select("id,title,category,description,urgency,created_at,budget_min,budget_max")
        .in("status", ["Open", "AI_Analysed", "Expert_Matched", "Quote_Sent"])
        .order("created_at", { ascending: false });
      return { verified: true as const, status: "Verified", list: list ?? [] };
    },
  });

  return (
    <AppShell title="Available jobs" nav={expertNav}>
      <h1 className="mb-4 text-2xl font-bold">Available jobs</h1>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {data && !data.verified && (
        <Empty title={data.status === "Submitted" ? "KYC under review" : "Verify your KYC first"} hint="Only verified experts can see and quote on jobs.">
          {data.status !== "Submitted" && <Button asChild className="mt-2 rounded-xl"><Link to="/e/onboarding">Start KYC</Link></Button>}
        </Empty>
      )}
      {data?.verified && data.list.length === 0 && <Empty title="No open jobs right now" hint="New problems will show up here." />}
      <div className="space-y-3">
        {data?.list.map((p) => (
          <div key={p.id} className="card-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{p.title}</p>
              <Pill t={p.urgency === "High" ? "bad" : "muted"}>{p.urgency}</Pill>
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs capitalize text-muted-foreground"><MapPin className="size-3" /> {p.category}</p>
            <p className="mt-2 line-clamp-2 text-sm">{p.description}</p>
            <Button asChild className="mt-3 h-11 w-full rounded-2xl"><Link to="/e/quote/$id" params={{ id: p.id }}>Send quote</Link></Button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
