import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMe, homeFor } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FixBridge" }, { name: "description", content: "Your FixBridge dashboard." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  useEffect(() => {
    if (me) navigate({ to: homeFor(me.role), replace: true });
  }, [me, navigate]);
  return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading your dashboard…</div>;
}
