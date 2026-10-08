import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type Role = "customer" | "expert" | "admin";

/** Ensure a profiles row (and experts row for experts) exists for the signed-in user. */
export async function ensureProfile() {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;
  const { data: existing } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
  if (existing) return existing;
  const meta = (u.user_metadata ?? {}) as { role?: string; name?: string };
  const role = meta.role === "expert" ? "expert" : "customer";
  const { data: created } = await supabase
    .from("profiles")
    .insert({ id: u.id, role, name: meta.name || u.email?.split("@")[0] || "User", phone: u.phone || null })
    .select("*")
    .single();
  if (role === "expert") {
    const { data: ex } = await supabase.from("experts").select("id").eq("user_id", u.id).maybeSingle();
    if (!ex) await supabase.from("experts").insert({ user_id: u.id, verification_status: "pending" });
  }
  return created;
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      const profile = await ensureProfile();
      const role = (["admin", "expert"].includes(profile?.role ?? "") ? profile!.role : "customer") as Role;
      return { user: data.user, role, profile };
    },
  });
}

export function homeFor(role: Role) {
  return role === "admin" ? "/admin" : role === "expert" ? "/e" : "/c";
}

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

export const STATUS_LABEL: Record<string, string> = {
  open: "Waiting for quotes",
  quoted: "Quotes received",
  assigned: "Expert assigned",
  on_the_way: "Expert on the way",
  started: "Work in progress",
  solved: "Marked solved",
  confirmed: "Confirmed",
  completed: "Completed",
  disputed: "In dispute",
  pending: "Pending review",
  approved: "Verified",
  rejected: "Rejected",
  held: "Held in escrow",
  release_pending: "Release pending",
  released: "Released to expert",
};
export const label = (s?: string | null) => (s ? STATUS_LABEL[s] ?? s.replace(/_/g, " ") : "—");

export const CATEGORY_KEYS = ["electrical", "plumbing", "carpentry", "mason", "painting", "ac-repair"];

/** Problems store "Title\n\nDetails" in description. */
export function splitDescription(d?: string | null) {
  const [title, ...rest] = (d ?? "").split("\n");
  return { title: title || "Untitled problem", body: rest.join("\n").trim() };
}

export function money(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function maskPhone(p?: string | null, reveal = false) {
  if (!p) return "Not shared";
  return reveal ? p : p.slice(0, 3) + "••••••" + p.slice(-2);
}
