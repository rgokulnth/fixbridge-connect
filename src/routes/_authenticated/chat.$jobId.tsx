import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Lock, Phone, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { customerNav, expertNav } from "@/components/navs";
import { maskPhone, useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat/$jobId")({
  head: () => ({ meta: [{ title: "Chat — FixBridge" }, { name: "description", content: "Chat with your expert or customer." }] }),
  component: Chat,
});

const CONTACT_RE = /(\+?\d[\d\s-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)/g;

function Chat() {
  const { jobId } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["chat", jobId],
    enabled: !!me,
    queryFn: async () => {
      const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      if (!job) throw new Error("Job not found");
      let { data: chat } = await supabase.from("chats").select("*").eq("job_id", jobId).maybeSingle();
      if (!chat) chat = (await supabase.from("chats").insert({ job_id: jobId, customer_id: job.customer_id, expert_id: job.expert_id }).select("*").single()).data;
      const { data: pay } = await supabase.from("payments").select("id").eq("job_id", jobId).limit(1).maybeSingle();
      const otherId = me!.user.id === job.customer_id ? job.expert_id : job.customer_id;
      const { data: other } = otherId ? await supabase.from("profiles").select("name,phone").eq("id", otherId).maybeSingle() : { data: null };
      const { data: messages } = await supabase.from("messages").select("*").eq("chat_id", chat!.id).order("created_at");
      return { chatId: chat!.id, paid: !!pay, other, messages: messages ?? [] };
    },
  });

  useEffect(() => {
    if (!data?.chatId) return;
    const ch = supabase
      .channel(`messages-${data.chatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${data.chatId}` }, () => qc.invalidateQueries({ queryKey: ["chat", jobId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [data?.chatId, jobId, qc]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [data?.messages.length]);

  const nav = me?.role === "expert" ? expertNav : customerNav;
  const show = (t: string | null) => (data?.paid ? t : (t ?? "").replace(CONTACT_RE, "••••••"));

  return (
    <AppShell title="Chat" nav={nav}>
      <div className="card-surface flex items-center gap-3 p-3">
        <span className="grid size-10 place-items-center rounded-full bg-accent font-bold text-accent-foreground">{(data?.other?.name ?? "U")[0]}</span>
        <div className="flex-1">
          <p className="font-semibold">{data?.other?.name ?? "…"}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {data?.paid ? <Phone className="size-3" /> : <Lock className="size-3" />} {maskPhone(data?.other?.phone, data?.paid)}
          </p>
        </div>
      </div>
      {!data?.paid && <p className="mt-2 text-center text-xs text-muted-foreground">Phone numbers stay hidden until payment is made.</p>}
      <div className="mt-4 space-y-2 pb-24">
        {data?.messages.length === 0 && <p className="text-center text-sm text-muted-foreground">Say vanakkam 👋</p>}
        {data?.messages.map((m) => (
          <div key={m.id} className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.sender_id === me?.user.id ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary")}>
            {show(m.text)}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form
        className="fixed inset-x-0 bottom-16 z-20 mx-auto flex max-w-5xl gap-2 bg-background p-3 md:bottom-0"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim() || !data) return;
          const { error } = await supabase.from("messages").insert({ chat_id: data.chatId, sender_id: me!.user.id, text: text.trim() });
          if (error) return void toast.error(error.message);
          setText("");
          qc.invalidateQueries({ queryKey: ["chat", jobId] });
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" className="h-12 flex-1 rounded-2xl border bg-secondary px-4 outline-none focus:ring-2 focus:ring-ring" />
        <button aria-label="Send" className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><Send className="size-5" /></button>
      </form>
    </AppShell>
  );
}
