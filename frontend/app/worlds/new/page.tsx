import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateWorldForm } from "./create-world-form";
import Link from "next/link";

export default async function NewWorldPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>

      {/* Back link positioned absolutely top-left */}
      <div className="absolute top-8 left-8">
        <Link
          href="/worlds"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back
        </Link>
      </div>

      <div className="w-full max-w-[420px] space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            New World
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter a store URL to spawn a simulation.
          </p>
        </div>

        <div className="relative">
          {/* Glow effect */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent blur-2xl" />
          <CreateWorldForm />
        </div>
      </div>
    </main>
  );
}
