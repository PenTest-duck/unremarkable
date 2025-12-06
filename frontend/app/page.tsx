import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthButtons } from "@/components/auth/auth-buttons";
import { Button } from "@/components/ui/button";

const highlights = [
  {
    title: "Scrape your store",
    body: "Pull products with Firecrawl and summarize with Gemini automatically.",
  },
  {
    title: "AI buyer personas",
    body: "Generate segments and figurines to test messaging before you launch.",
  },
  {
    title: "Minimal, fast",
    body: "One-page flows to create a world and start simulating campaigns.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-background text-foreground selection:bg-primary/5">
      {/* Subtle grid pattern background */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>

      <div className="mx-auto flex max-w-7xl flex-col px-6 py-12 lg:px-8">
        <header className="flex items-center justify-between py-6">
          <div className="text-xl font-bold tracking-tight text-primary">
            Unremarkable
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Button
                asChild
                variant="ghost"
                className="text-muted-foreground hover:text-primary"
              >
                <Link href="/worlds">Enter worlds</Link>
              </Button>
            ) : null}
            <AuthButtons isSignedIn={!!user} next="/worlds" />
          </div>
        </header>

        <div className="mt-20 lg:mt-32 grid gap-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div className="flex flex-col gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-secondary-foreground backdrop-blur-sm">
                AI Buyer Personas
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-primary sm:text-7xl">
                Simulate your <br />
                <span className="text-muted-foreground/80">customers.</span>
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground leading-relaxed">
                Don&apos;t launch campaigns into the void. Create a simulated
                world from your store URL, generate AI personas, and test your
                marketing angles before spending a dime.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="h-12 px-8 text-base shadow-sm"
              >
                <Link href="/worlds">Start simulating</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base bg-background/50 backdrop-blur-sm"
              >
                <Link href="/worlds/new">Create world</Link>
              </Button>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-3 border-t border-border pt-12">
              {highlights.map((item) => (
                <div key={item.title} className="group space-y-2">
                  <h3 className="font-semibold text-primary group-hover:text-primary/80 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative lg:mt-8">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-primary/10 to-transparent blur-2xl opacity-50" />
            <div className="relative rounded-2xl border border-border bg-card/80 p-8 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-border pb-6 mb-6">
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Quickstart
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-card-foreground">
                    Launch a simulation
                  </h3>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  60s setup
                </span>
              </div>

              <ol className="relative space-y-8 border-l border-border ml-3">
                <li className="ml-6">
                  <span className="absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary ring-4 ring-background" />
                  <h4 className="text-sm font-medium text-primary">Sign in</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Authenticate securely with Google
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-border ring-4 ring-background" />
                  <h4 className="text-sm font-medium text-primary">
                    Paste URL
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    We scrape your store & products
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-border ring-4 ring-background" />
                  <h4 className="text-sm font-medium text-primary">Simulate</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Chat with generated personas
                  </p>
                </li>
              </ol>

              <div className="mt-8 pt-6 border-t border-border">
                <AuthButtons isSignedIn={!!user} next="/worlds/new" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
