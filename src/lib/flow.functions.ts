import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Placeholder payment flow (no gateway yet): accepting a quote marks the
// payment as Held_in_escrow directly. Swap for real checkout later.

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
async function isAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  return !!data;
}

export const acceptQuoteHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ quoteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: q } = await db.from("quotes").select("*, problems(*)").eq("id", data.quoteId).maybeSingle();
    const p = q?.problems as any;
    if (!q || !p || p.customer_id !== context.userId) throw new Error("Quote not found");
    const { data: existing } = await db.from("jobs").select("id").eq("problem_id", p.id).maybeSingle();
    if (existing) throw new Error("A job already exists for this problem");
    const { data: job, error } = await db
      .from("jobs")
      .insert({ problem_id: p.id, quote_id: q.id, expert_id: q.expert_id, customer_id: context.userId, status: "Assigned" })
      .select("*")
      .single();
    if (error || !job) throw new Error(error?.message ?? "Could not create job");
    const commission = Math.round(q.amount * 0.2);
    await db.from("payments").insert({
      job_id: job.id, customer_id: context.userId, expert_id: q.expert_id, provider: "razorpay",
      amount: q.amount, commission, status: "Held_in_escrow", provider_order_id: "placeholder",
    });
    await db.from("conversations").insert({ job_id: job.id });
    await db.from("quotes").update({ status: "Accepted" }).eq("id", q.id);
    await db.from("quotes").update({ status: "Rejected" }).eq("problem_id", p.id).neq("id", q.id);
    await db.from("problems").update({ status: "Payment_Held" }).eq("id", p.id);
    return { jobId: job.id };
  });

const EXPERT_STEPS = { On_the_way: "Payment_Held", Started: "Job_Started", Solved: "Solved" } as const;

export const expertSetJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid(), status: z.enum(["On_the_way", "Started", "Solved"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || job.expert_id !== context.userId) throw new Error("Job not found");
    const patch: any = { status: data.status };
    if (data.status === "Started") patch.started_at = new Date().toISOString();
    if (data.status === "Solved") patch.solved_at = new Date().toISOString();
    await db.from("jobs").update(patch).eq("id", job.id);
    await db.from("problems").update({ status: EXPERT_STEPS[data.status] }).eq("id", job.problem_id);
    return { ok: true };
  });

export const customerConfirmJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || job.customer_id !== context.userId) throw new Error("Job not found");
    if (job.status !== "Solved") throw new Error("Expert hasn't marked it solved yet");
    await db.from("jobs").update({ status: "Confirmed", confirmed_at: new Date().toISOString() }).eq("id", job.id);
    await db.from("payments").update({ status: "Release_pending" }).eq("job_id", job.id).eq("status", "Held_in_escrow");
    return { ok: true };
  });

export const customerDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid(), reason: z.string().min(5).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || job.customer_id !== context.userId) throw new Error("Job not found");
    await db.from("disputes").insert({ job_id: job.id, raised_by: context.userId, reason: data.reason });
    await db.from("jobs").update({ status: "Disputed" }).eq("id", job.id);
    await db.from("problems").update({ status: "Disputed" }).eq("id", job.problem_id);
    return { ok: true };
  });

export const adminReleasePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const db = await admin();
    const { data: p } = await db.from("payments").select("*").eq("id", data.paymentId).single();
    if (!p || !["Held_in_escrow", "Release_pending"].includes(p.status)) throw new Error("Payment not releasable");
    await db.from("payments").update({ status: "Released_to_expert", updated_at: new Date().toISOString() }).eq("id", p.id);
    const { data: job } = await db.from("jobs").update({ status: "Completed" }).eq("id", p.job_id).select("problem_id").single();
    if (job) await db.from("problems").update({ status: "Payment_Done" }).eq("id", job.problem_id);
    return { ok: true, payout: p.amount - p.commission };
  });

export const adminKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ expertId: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const db = await admin();
    await db.from("experts").update({ kyc_status: data.approve ? "Verified" : "Failed" }).eq("id", data.expertId);
    return { ok: true };
  });

export const signedUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bucket: z.enum(["kyc-docs", "problem-media"]), paths: z.array(z.string()).max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.paths.length) return { urls: [] as string[] };
    const { data: s } = await context.supabase.storage.from(data.bucket).createSignedUrls(data.paths, 3600);
    return { urls: (s ?? []).map((x: any) => x.signedUrl as string) };
  });

export const expertSendQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ problemId: z.string().uuid(), amount: z.number().int().min(1).max(10000000), days: z.number().int().min(0).max(365), materials: z.string().max(1000), description: z.string().max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: ex } = await db.from("experts").select("kyc_status").eq("id", context.userId).maybeSingle();
    if (ex?.kyc_status !== "Verified") throw new Error("Complete KYC verification first");
    const { data: p } = await db.from("problems").select("id,status").eq("id", data.problemId).maybeSingle();
    if (!p || !["Open", "AI_Analysed", "Expert_Matched", "Quote_Sent"].includes(p.status)) throw new Error("Problem is not accepting quotes");
    const { error } = await db.from("quotes").insert({
      problem_id: p.id, expert_id: context.userId, amount: data.amount, days: data.days,
      materials: data.materials || null, description: data.description || "Quote", status: "Sent",
    });
    if (error) throw new Error(error.message);
    await db.from("problems").update({ status: "Quote_Sent" }).eq("id", p.id);
    return { ok: true };
  });

export const expertSubmitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().min(2).max(100), phone: z.string().max(20), skills: z.array(z.string()).min(1).max(10), aadhaarPath: z.string(), photoPath: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.from("experts").upsert({
      id: context.userId, name: data.name, phone: data.phone, skills: data.skills,
      aadhaar_path: data.aadhaarPath, photo_path: data.photoPath, kyc_status: "Submitted",
    });
    if (error) throw new Error(error.message);
    await db.from("user_roles").upsert({ user_id: context.userId, role: "expert" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    return { ok: true };
  });

export const customerRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid(), stars: z.number().int().min(1).max(5), comment: z.string().max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || job.customer_id !== context.userId) throw new Error("Job not found");
    const { error } = await db.from("ratings").insert({ job_id: job.id, customer_id: context.userId, expert_id: job.expert_id, stars: data.stars, comment: data.comment || null });
    if (error) throw new Error(error.message);
    const { data: all } = await db.from("ratings").select("stars").eq("expert_id", job.expert_id);
    const n = all?.length ?? 0;
    const avg = n ? all!.reduce((s, r) => s + r.stars, 0) / n : 0;
    await db.from("experts").update({ rating: Math.round(avg * 10) / 10, rating_count: n }).eq("id", job.expert_id);
    return { ok: true };
  });

const PHONE_RE = /(\+?\d[\d\s-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)/g;
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid(), text: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || (job.customer_id !== context.userId && job.expert_id !== context.userId)) throw new Error("Job not found");
    let { data: conv } = await db.from("conversations").select("id").eq("job_id", job.id).maybeSingle();
    if (!conv) conv = (await db.from("conversations").insert({ job_id: job.id }).select("id").single()).data;
    const { data: pay } = await db.from("payments").select("status").eq("job_id", job.id).maybeSingle();
    const paid = !!pay && ["Held_in_escrow", "Paid_captured", "Release_pending", "Released_to_expert"].includes(pay.status);
    const masked = !paid && PHONE_RE.test(data.text);
    const text = paid ? data.text : data.text.replace(PHONE_RE, "••••••");
    const { error } = await db.from("messages").insert({ conversation_id: conv!.id, sender_id: context.userId, text, masked });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: job } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || (job.customer_id !== context.userId && job.expert_id !== context.userId)) throw new Error("Job not found");
    const { data: conv } = await db.from("conversations").select("id").eq("job_id", job.id).maybeSingle();
    const { data: pay } = await db.from("payments").select("status").eq("job_id", job.id).maybeSingle();
    const paid = !!pay && ["Held_in_escrow", "Paid_captured", "Release_pending", "Released_to_expert"].includes(pay.status);
    const { data: ex } = await db.from("experts").select("name, phone").eq("id", job.expert_id).maybeSingle();
    const { data: cu } = await db.from("customers").select("name, phone").eq("id", job.customer_id).maybeSingle();
    const other = context.userId === job.customer_id ? ex : cu;
    const mask = (p?: string | null) => (!p ? "—" : paid ? p : p.slice(0, 2) + "••••••" + p.slice(-2));
    const msgs = conv ? (await db.from("messages").select("*").eq("conversation_id", conv.id).order("created_at")).data ?? [] : [];
    return { paid, otherName: other?.name ?? "User", otherPhone: mask(other?.phone), messages: msgs, me: context.userId };
  });

export const adminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const db = await admin();
    const [jobs, experts, payments, disputes] = await Promise.all([
      db.from("jobs").select("id,status,created_at,problem_id,expert_id,problems(title)").order("created_at", { ascending: false }).limit(100),
      db.from("experts").select("id,name,phone,skills,kyc_status,aadhaar_path,photo_path").order("created_at", { ascending: false }),
      db.from("payments").select("id,job_id,amount,commission,status,currency").order("created_at", { ascending: false }).limit(100),
      db.from("disputes").select("id,job_id,reason,status,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    return { jobs: jobs.data ?? [], experts: experts.data ?? [], payments: payments.data ?? [], disputes: disputes.data ?? [] };
  });
