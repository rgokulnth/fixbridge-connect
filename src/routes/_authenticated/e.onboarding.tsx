import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Pill, statusTone } from "@/components/app-shell";
import { expertNav } from "@/components/navs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { expertSubmitKyc } from "@/lib/flow.functions";
import { SKILL_OPTIONS } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/e/onboarding")({
  head: () => ({ meta: [{ title: "Expert KYC — FixBridge" }, { name: "description", content: "Upload Aadhaar and photo to get verified." }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const submit = useServerFn(expertSubmitKyc);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [aadhaar, setAadhaar] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: ex } = useQuery({
    queryKey: ["my-expert"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      return (await supabase.from("experts").select("kyc_status,kyc_note").eq("id", u.user!.id).maybeSingle()).data;
    },
  });

  const up = async (uid: string, f: File, kind: string) => {
    const path = `${uid}/${kind}-${Date.now()}.${f.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("kyc-docs").upload(path, f, { upsert: true });
    if (error) throw error;
    return path;
  };

  return (
    <AppShell title="KYC" nav={expertNav}>
      <h1 className="text-2xl font-bold">Expert verification</h1>
      {ex && (
        <p className="mt-2 text-sm">Status: <Pill t={statusTone(ex.kyc_status)}>{ex.kyc_status === "Submitted" ? "Pending review" : ex.kyc_status.replace("_", " ")}</Pill> {ex.kyc_note}</p>
      )}
      <form
        className="mt-5 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!aadhaar || !photo || !skills.length) { toast.error("Add Aadhaar, photo and at least one skill"); return; }
          setBusy(true);
          try {
            const { data: u } = await supabase.auth.getUser();
            const [a, p] = await Promise.all([up(u.user!.id, aadhaar, "aadhaar"), up(u.user!.id, photo, "photo")]);
            await submit({ data: { name, phone, skills, aadhaarPath: a, photoPath: p } });
            toast.success("Submitted! Admin will verify soon.");
            navigate({ to: "/e" });
          } catch (err: any) {
            toast.error(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div><Label>Full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-12 rounded-2xl" /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 h-12 rounded-2xl" /></div>
        <div>
          <Label>Skills</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {SKILL_OPTIONS.concat("mason").map((s) => (
              <button type="button" key={s} onClick={() => setSkills((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))}
                className={cn("rounded-full border px-3 py-1.5 text-sm capitalize", skills.includes(s) && "border-primary bg-primary text-primary-foreground")}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div><Label>Aadhaar card (photo or PDF)</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setAadhaar(e.target.files?.[0] ?? null)} className="mt-1 rounded-2xl" /></div>
        <div><Label>Your photo</Label><Input type="file" accept="image/*" capture="user" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="mt-1 rounded-2xl" /></div>
        <Button disabled={busy} className="h-14 w-full rounded-2xl text-base">{busy ? "Uploading…" : "Submit for verification"}</Button>
      </form>
    </AppShell>
  );
}
