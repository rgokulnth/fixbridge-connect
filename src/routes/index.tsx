import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Camera, CircleDollarSign, MessageCircle, ShieldCheck, Star, Wrench, Zap, Droplets, Hammer, BrickWall, Paintbrush, Snowflake, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FixBridge - Find Trusted Local Experts" },
      { name: "description", content: "Post a home problem with a photo, get quotes from verified local electricians, plumbers and carpenters, and pay only when the job is done." },
      { property: "og:title", content: "FixBridge - Find Trusted Local Experts" },
      { property: "og:description", content: "Verified local experts for every home repair. Quotes in minutes, money held safely until you confirm." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const CATS = [
  { label: "Electrician", icon: Zap, hint: "Wiring, switches, fans" },
  { label: "Plumber", icon: Droplets, hint: "Leaks, taps, motors" },
  { label: "Carpenter", icon: Hammer, hint: "Doors, furniture" },
  { label: "Mason", icon: BrickWall, hint: "Cracks, tiling" },
  { label: "Painter", icon: Paintbrush, hint: "Walls, touch-ups" },
  { label: "AC Repair", icon: Snowflake, hint: "Service, gas refill" },
];
const STEPS = [
  { icon: Camera, t: "Post with a photo", d: "Snap the problem, add a voice note. Our AI suggests what's wrong and how urgent it is." },
  { icon: CircleDollarSign, t: "Compare quotes", d: "KYC-verified experts nearby send their price, timeline and warranty." },
  { icon: MessageCircle, t: "Chat & book", d: "Pick the best quote, chat in the app, and track your expert live." },
  { icon: ShieldCheck, t: "Pay when it's fixed", d: "Money stays in escrow and is released only after you confirm the job." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Wrench className="size-4" /></span>
          <span className="font-display text-lg font-bold">FixBridge</span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" className="rounded-xl"><Link to="/auth">Sign in</Link></Button>
            <Button asChild className="hidden rounded-xl sm:inline-flex"><Link to="/auth">Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-2 md:py-20">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <BadgeCheck className="size-3.5" /> Every expert Aadhaar-verified
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] md:text-6xl">
            Veetla problem?<br /><span className="text-primary">Fix pannalam.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Find trusted local experts for any home repair. Post a photo, compare quotes in minutes, and pay only when the job is done right.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-14 rounded-2xl px-7 text-base"><Link to="/auth">Post a problem <ArrowRight className="size-4" /></Link></Button>
            <Button asChild variant="outline" className="h-14 rounded-2xl px-7 text-base"><Link to="/auth">Join as an expert</Link></Button>
          </div>
          <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Star className="size-4 fill-primary text-primary" /> 4.8 average rating</span>
            <span>Quotes in under 15 min</span>
          </div>
        </div>
        <div className="relative">
          <div className="card-surface overflow-hidden p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground"><Droplets className="size-6" /></span>
              <div>
                <p className="font-semibold">Motor running but no water</p>
                <p className="text-xs text-muted-foreground">Plumbing · Anna Nagar, Chennai</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-secondary p-3 text-sm">
              <p className="font-semibold">AI suggestion</p>
              <p className="text-muted-foreground">Likely an air lock in the suction pipe. Medium urgency.</p>
            </div>
            <div className="mt-4 space-y-2">
              {[["Ravi K.", "₹650", "4.9"], ["Suresh M.", "₹800", "4.7"]].map(([n, a, r]) => (
                <div key={n} className="flex items-center gap-3 rounded-2xl border p-3">
                  <span className="grid size-9 place-items-center rounded-full bg-primary font-bold text-primary-foreground">{n?.[0]}</span>
                  <div className="flex-1"><p className="text-sm font-semibold">{n}</p><p className="text-xs text-muted-foreground">★ {r} · Verified</p></div>
                  <span className="font-bold text-primary">{a}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="text-3xl font-bold">What needs fixing?</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATS.map((c) => (
            <Link key={c.label} to="/auth" className="card-surface flex flex-col items-start gap-3 p-4 transition hover:-translate-y-0.5">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground"><c.icon className="size-5" /></span>
              <div><p className="font-semibold">{c.label}</p><p className="text-xs text-muted-foreground">{c.hint}</p></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="text-3xl font-bold">How FixBridge works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.t} className="card-surface p-5">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><s.icon className="size-5" /></span>
                <span className="font-display text-3xl font-bold text-muted-foreground/40">0{i + 1}</span>
              </div>
              <p className="mt-4 font-semibold">{s.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-6">
        <div className="rounded-3xl bg-primary p-8 text-primary-foreground md:p-12">
          <h2 className="text-3xl font-bold">Skilled with your hands? Earn with FixBridge.</h2>
          <p className="mt-2 max-w-xl opacity-90">Get verified once with Aadhaar, receive jobs near you, and get paid straight after every confirmed job.</p>
          <Button asChild variant="secondary" className="mt-6 h-12 rounded-2xl px-6"><Link to="/auth">Become an expert</Link></Button>
        </div>
      </section>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} FixBridge · Made in Tamil Nadu</footer>
    </div>
  );
}
