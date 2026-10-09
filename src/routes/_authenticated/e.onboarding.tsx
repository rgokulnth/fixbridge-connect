import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Pill, statusTone } from "@/components/app-shell";
import { expertNav } from "@/components/navs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureProblemBucket } from "@/lib/flow.functions";
import { CATEGORY_KEYS, label, useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/e/onboarding")({
  head: () => ({ meta: [{ title: "Expert verification — FixBridge" }, { name: "description", content: "Upload Aadhaar and photo to get verified." }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const ensureBucket = useServerFn(ensureProblemBucket);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [skill, setSkill] = useState("");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: ex } = useQuery({
    queryKey: ["my-expert", me?.user.id],
    enabled: !!me,
    queryFn: async () => (await supabase.from("experts").select("*").eq("user_id", me!.user.id).maybeSingle()).data,
  });

  return (
    <AppShell title="KYC" nav={expertNav}>
      <h1 className="text-2xl font-bold">Expert verification</h1>
      {ex && <p className="mt-2 text-sm">Status: <Pill t={statusTone(ex.verification_status)}>{label(ex.verification_status)}</Pill></p>}
      <form
        className="mt-5 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!front || !photo || !skill) { toast.error("Add Aadhaar front, your photo and a skill"); return; }
          setBusy(true);
          try {
            const uid = me!.user.id;
            await ensureBucket();
            const up = async (f: File, kind: string) => {
              const path = `kyc/${uid}/${kind}-${Date.now()}.${f.name.split(".").pop()}`;
              const { error } = await supabase.storage.from("problem-images").upload(path, f, { upsert: true });
              if (error) throw error;
              return path;
            };
            const [a, b, p] = await Promise.all([up(front, "aadhaar-front"), back ? up(back, "aadhaar-back") : Promise.resolve(null), up(photo, "photo")]);
            const row = { user_id: uid, skill, aadhaar_front: a, aadhaar_back: b, photo: p, verification_status: "pending" };
            const res = ex ? await supabase.from("experts").update(row).eq("id", ex.id) : await supabase.from("experts").insert(row);
            if (res.error) throw res.error;
            await supabase.from("profiles").update({ ...(name ? { name } : {}), ...(phone ? { phone } : {}), role: me!.role === "admin" ? "admin" : "expert" }).eq("id", uid);
            qc.invalidateQueries();
            toast.success("Submitted! We'll verify you soon.");
            navigate({ to: "/e" });
          } catch (err: any) {
            toast.error(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={me?.profile?.name ?? ""} className="mt-1 h-12 rounded-2xl" /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" className="mt-1 h-12 rounded-2xl" /></div>
        <div>
          <Label>Main skill</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_KEYS.map((s) => (
              <button type="button" key={s} onClick={() => setSkill(s)} className={cn("rounded-full border px-3 py-1.5 text-sm capitalize", skill === s && "border-primary bg-primary text-primary-foreground")}>{s.replace("-", " ")}</button>
            ))}
          </div>
        </div>
        <div><Label>Aadhaar front</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setFront(e.target.files?.[0] ?? null)} className="mt-1 rounded-2xl" /></div>
        <div><Label>Aadhaar back (optional)</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setBack(e.target.files?.[0] ?? null)} className="mt-1 rounded-2xl" /></div>
        <div><Label>Your photo</Label><Input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="mt-1 rounded-2xl" /></div>
        <Button disabled={busy || !me} className="h-14 w-full rounded-2xl text-base">{busy ? "Uploading…" : "Submit for verification"}</Button>
      </form>
    </AppShell>
  );
}
