import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Phone, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { customerNav, expertNav } from "@/components/navs";
import { useMe } from "@/lib/session";
import { getChat, sendMessage } from "@/lib/flow.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat/$jobId")({
  head: () => ({ meta: [{ title: "Chat — FixBridge" }, { name: "description", content: "Chat about your job." }] }),
  component: Chat,
});

function Chat() {
  const { jobId } = Route.useParams();
  const { data: me } = useMe();
  const load = useServerFn(getChat);
  const send = useServerFn(sendMessage);
  const [text, setText] = useState("");
  const { data, refetch } = useQuery({ queryKey: ["chat", jobId], queryFn: () => load({ data: { jobId } }), refetchInterval: 4000 });
  const nav = me?.role === "expert" ? expertNav : customerNav;

  return (
    <AppShell title="Chat" nav={nav}>
      <div className="card-surface flex items-center gap-3 p-3">
        <span className="grid size-10 place-items-center rounded-full bg-accent font-bold text-accent-foreground">{(data?.otherName ?? "U")[0]}</span>
        <div className="flex-1">
          <p className="font-semibold">{data?.otherName ?? "…"}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {data?.paid ? <Phone className="size-3" /> : <Lock className="size-3" />} {data?.otherPhone}
          </p>
        </div>
      </div>
      {!data?.paid && <p className="mt-2 text-center text-xs text-muted-foreground">Contact details are hidden until payment is held.</p>}
      <div className="mt-4 space-y-2 pb-20">
        {data?.messages.length === 0 && <p className="text-center text-sm text-muted-foreground">Say vanakkam 👋</p>}
        {data?.messages.map((m: any) => (
          <div key={m.id} className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.sender_id === data.me ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary")}>
            {m.text}
          </div>
        ))}
      </div>
      <form
        className="fixed inset-x-0 bottom-16 z-20 mx-auto flex max-w-5xl gap-2 bg-background p-3 md:bottom-0"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          try {
            await send({ data: { jobId, text } });
            setText("");
            refetch();
          } catch (err: any) {
            toast.error(err.message);
          }
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" className="h-12 flex-1 rounded-2xl border bg-secondary px-4 outline-none focus:ring-2 focus:ring-ring" />
        <button aria-label="Send" className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><Send className="size-5" /></button>
      </form>
    </AppShell>
  );
}
