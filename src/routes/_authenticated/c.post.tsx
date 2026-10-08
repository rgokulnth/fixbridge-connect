import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Camera, MapPin, Mic, Video, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { customerNav } from "@/components/navs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ensureProblemBucket } from "@/lib/flow.functions";
import { CATEGORY_KEYS } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/c/post")({
  validateSearch: z.object({ q: z.string().optional(), category: z.string().optional() }),
  head: () => ({ meta: [{ title: "Post a problem — FixBridge" }, { name: "description", content: "Upload photos, video and a voice note of your problem." }] }),
  component: PostProblem,
});

const MOCK_AI: Record<string, string> = {
  electrical: "Possible loose connection or tripped MCB. Switch off the mains before anyone touches the wiring.",
  plumbing: "Likely a worn washer, blocked line or air lock. Close the main valve to limit water damage.",
  carpentry: "Hinges or joints have probably loosened. A carpenter can re-fix or replace hardware in one visit.",
  mason: "Looks like surface cracking from moisture. Expert should check for seepage before patching.",
  painting: "Damp patches or peeling paint — primer and waterproof coat recommended.",
  "ac-repair": "Common causes: dirty filters, low gas or a faulty capacitor. A service visit is recommended.",
};

function PostProblem() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const ensureBucket = useServerFn(ensureProblemBucket);
  const [title, setTitle] = useState(search.q ?? "");
  const [category, setCategory] = useState(search.category ?? "plumbing");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [urgency, setUrgency] = useState<"low" | "medium" | "high">("medium");
  const [photos, setPhotos] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [voice, setVoice] = useState<File | null>(null);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast.message("Location not shared — you can type your area instead"),
    );
  }, []);

  async function checkVideo(f: File) {
    const url = URL.createObjectURL(f);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    await new Promise((r) => (v.onloadedmetadata = r));
    URL.revokeObjectURL(url);
    if (v.duration > 31) { toast.error("Video must be 30 seconds or less"); return; }
    setVideo(f);
  }

  async function submit() {
    if (title.trim().length < 3) { toast.error("Add a short title"); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      if (photos.length || video || voice) await ensureBucket();
      const up = async (f: File) => {
        const path = `${uid}/${crypto.randomUUID()}-${f.name.replace(/[^\w.]/g, "_")}`;
        const { error } = await supabase.storage.from("problem-images").upload(path, f);
        if (error) throw error;
        return supabase.storage.from("problem-images").getPublicUrl(path).data.publicUrl;
      };
      const photoUrls = await Promise.all(photos.map(up));
      const videoUrl = video ? await up(video) : null;
      const voiceUrl = voice ? await up(voice) : null;
      const { data, error } = await supabase
        .from("problems")
        .insert({
          customer_id: uid,
          description: `${title.trim()}\n${description.trim()}`,
          location: address || (loc ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : null),
          lat: loc?.lat ?? null, lng: loc?.lng ?? null,
          photos: photoUrls, video: videoUrl, voice_note: voiceUrl, status: "open",
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("ai_analyses").insert({ problem_id: data.id, problem_type: category, urgency, suggestion: MOCK_AI[category] ?? "An expert will inspect and confirm the cause." });
      toast.success("Problem posted! Experts will quote soon.");
      navigate({ to: "/problems/$id", params: { id: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Post problem" nav={customerNav}>
      <h1 className="text-2xl font-bold">Post your problem</h1>
      <div className="mt-5 space-y-4">
        <Input placeholder="Eg: Motor running but no water" value={title} onChange={(e) => setTitle(e.target.value)} className="h-12 rounded-xl" />
        <div className="flex flex-wrap gap-2">
          {CATEGORY_KEYS.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={cn("rounded-full border px-3 py-1.5 text-sm capitalize", category === c && "border-primary bg-accent font-semibold text-accent-foreground")}>
              {c.replace("-", " ")}
            </button>
          ))}
        </div>
        <Textarea placeholder="Describe what's happening…" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-28 rounded-xl" />

        <div>
          <p className="mb-2 text-sm font-semibold">Photos ({photos.length}/3)</p>
          <div className="flex gap-2">
            {photos.map((f, i) => (
              <div key={i} className="relative size-20 overflow-hidden rounded-xl border">
                <img src={URL.createObjectURL(f)} alt="" className="size-full object-cover" />
                <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-card p-0.5" aria-label="Remove photo"><X className="size-3" /></button>
              </div>
            ))}
            {photos.length < 3 && (
              <label className="grid size-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed text-muted-foreground">
                <Camera className="size-6" />
                <input type="file" accept="image/*" multiple hidden onChange={(e) => setPhotos([...photos, ...Array.from(e.target.files ?? [])].slice(0, 3))} />
              </label>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="card-surface flex cursor-pointer items-center gap-2 p-3 text-sm">
            <Video className="size-5 text-primary" />
            <span className="truncate">{video ? video.name : "30s video"}</span>
            <input type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && checkVideo(e.target.files[0])} />
          </label>
          <label className="card-surface flex cursor-pointer items-center gap-2 p-3 text-sm">
            <Mic className="size-5 text-primary" />
            <span className="truncate">{voice ? voice.name : "Voice note"}</span>
            <input type="file" accept="audio/*" hidden onChange={(e) => setVoice(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Urgency</p>
          <div className="grid grid-cols-3 gap-2">
            {(["low", "medium", "high"] as const).map((u) => (
              <button key={u} onClick={() => setUrgency(u)} className={cn("rounded-xl border py-2 text-sm capitalize", urgency === u && "border-primary bg-accent font-semibold")}>{u}</button>
            ))}
          </div>
        </div>
        <Input placeholder="Area / address (eg: Anna Nagar, Chennai)" value={address} onChange={(e) => setAddress(e.target.value)} className="h-12 rounded-xl" />
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4" /> {loc ? `Location captured (${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)})` : "Getting location…"}
        </p>
        <Button className="h-14 w-full rounded-2xl text-base" disabled={busy} onClick={submit}>{busy ? "Posting…" : "Post problem"}</Button>
      </div>
    </AppShell>
  );
}
