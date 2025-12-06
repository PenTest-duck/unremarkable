import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/lib/supabase/server";

// Helper function to generate redirect URL
function getRedirectUrl(origin: string, request: Request, path: string) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  if (isLocalEnv) {
    return `${origin}${path}`;
  } else if (forwardedHost) {
    return `https://${forwardedHost}${path}`;
  } else {
    return `${origin}${path}`;
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/")) {
    // if "next" is not a relative URL, use the default
    next = "/";
  }

  if (code) {
    const supabase = await createClient();
    const { data: resp, error } = await supabase.auth.exchangeCodeForSession(
      code
    );
    if (!error) {
      // If new signup, add to profiles table
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", resp.user.id)
        .single();

      // Extract user metadata from auth user
      const userMetadata = resp.user.user_metadata || {};
      const avatarUrl =
        resp.user.user_metadata?.avatar_url ||
        resp.user.user_metadata?.picture ||
        null;
      const email = resp.user.email as string;

      if (!existingProfile) {
        const fullName = (userMetadata.name || "").trim();
        const firstSpaceIdx = fullName.indexOf(" ");
        const firstName =
          firstSpaceIdx === -1 ? fullName : fullName.slice(0, firstSpaceIdx);
        const lastName =
          firstSpaceIdx === -1 ? "" : fullName.slice(firstSpaceIdx + 1).trim();

        // Insert profile public table
        const { error: newProfileError } = await supabase
          .from("profiles")
          .insert({
            id: resp.user.id,
            first_name: firstName,
            last_name: lastName,
            avatar_url: avatarUrl,
            email: email,
          });
        if (newProfileError) {
          console.error("Error creating new profile:", newProfileError);
          throw new Error("Failed to create new profile");
        }
      }

      // Default redirect (no form data or project creation failed)
      return NextResponse.redirect(getRedirectUrl(origin, request, next));
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
