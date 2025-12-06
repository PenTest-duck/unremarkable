import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

type Props = {
  isSignedIn: boolean;
  next?: string;
};

function getRedirectOrigin() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    "http://localhost:3000";
  return siteUrl;
}

async function signInAction(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const next = (formData.get("next") as string) || "/worlds";
  const redirectTo = `${getRedirectOrigin()}/api/callback?next=${encodeURIComponent(
    next
  )}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error || !data.url) {
    console.error("sign-in failed", error);
    return;
  }

  redirect(data.url);
}

async function signOutAction() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export function AuthButtons({ isSignedIn, next = "/worlds" }: Props) {
  if (!isSignedIn) {
    return (
      <form action={signInAction}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit">Sign in with Google</Button>
      </form>
    );
  }

  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost">
        Sign out
      </Button>
    </form>
  );
}

