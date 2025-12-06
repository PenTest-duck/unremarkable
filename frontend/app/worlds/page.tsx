import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthButtons } from "@/components/auth/auth-buttons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function WorldsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Unremarkable
          </p>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            Build marketing worlds with AI buyer personas.
          </h1>
          <p className="text-muted-foreground">
            Sign in to create your first world and simulate how customers react.
          </p>
        </div>
        <AuthButtons isSignedIn={false} next="/worlds" />
      </main>
    );
  }

  const { data: worlds, error } = await supabase
    .from("worlds")
    .select("id,name,store_url,description,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12 lg:px-8">
      <header className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-secondary-foreground backdrop-blur-sm">
            Dashboard
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
            Your Worlds
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground leading-relaxed">
            Manage your simulated universes. Each world contains unique customer
            personas generated from your store data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AuthButtons isSignedIn={true} next="/worlds" />
          <Button asChild size="lg" className="shadow-sm">
            <Link href="/worlds/new">Create new world</Link>
          </Button>
        </div>
      </header>

      <div className="mt-16">
        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-4 text-sm text-destructive font-medium">
            Unable to load your worlds. Please refresh the page.
          </div>
        ) : (worlds?.length ?? 0) === 0 ? (
          <Card className="group relative overflow-hidden border-dashed bg-muted/20 hover:bg-muted/40 transition-colors">
            <CardHeader className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between p-8">
              <div className="space-y-1">
                <CardTitle className="text-xl">
                  Start your first world
                </CardTitle>
                <CardDescription className="text-base">
                  Scrape a store URL to generate a backdrop and initial
                  products.
                </CardDescription>
              </div>
              <CardAction>
                <Button asChild size="lg">
                  <Link href="/worlds/new">Create world</Link>
                </Button>
              </CardAction>
            </CardHeader>
          </Card>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {worlds?.map((world) => (
              <Card
                key={world.id}
                className="group relative flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-primary/20"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl font-bold tracking-tight">
                      {world.name}
                    </CardTitle>
                    {/* Status indicator placeholder */}
                    <div className="h-2 w-2 rounded-full bg-green-500/50 shadow-[0_0_8px] shadow-green-500/30" />
                  </div>
                  <CardDescription className="break-all font-mono text-xs opacity-70">
                    {world.store_url.replace(/^https?:\/\//, "")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-6">
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {world.description || "No description available yet."}
                  </p>
                  <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                    <span>
                      {new Date(world.created_at).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </span>
                    <Link
                      href={`/worlds/${world.id}`}
                      className="flex items-center gap-1 font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Enter world{" "}
                      <span className="text-lg leading-none">→</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
