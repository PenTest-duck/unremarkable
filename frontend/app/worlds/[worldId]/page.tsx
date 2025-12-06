import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { WorldView } from "@/components/worlds/world-view";

export default async function WorldPage({
  params,
}: {
  params: Promise<{ worldId: string }>;
}) {
  const { worldId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Fetch world details
  const { data: world, error: worldError } = await supabase
    .from("worlds")
    .select("*")
    .eq("id", worldId)
    .single();

  if (worldError || !world) {
    notFound();
  }

  // Fetch segments
  const { data: segments } = await supabase
    .from("segments")
    .select("*")
    .eq("world_id", worldId);

  // Fetch personas with segments
  const { data: personas } = await supabase
    .from("personas")
    .select("*, segments(name)")
    .eq("world_id", worldId);

  // Fetch products for campaign creation
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("world_id", worldId);

  // Generate presigned URLs for personas if they exist (mock logic for now as generation isn't hooked up)
  // In a real scenario, we'd list files from storage or use a signed URL if path is stored
  // For now we'll assume we construct the path and sign it
  const personasWithImages = await Promise.all(
    (personas || []).map(async (p) => {
      // Path structure from plan: /{userId}/{worldId}/{segmentId}/{personaId}/character.png
      // NOTE: We need userId from the world or current user? Plan says /{userId}/... likely the creator.
      // Assuming user.id is the creator for now since we check auth.
      const path = `${user.id}/${worldId}/${p.segment_id}/${p.id}/character.png`;

      // Check if image exists or just sign it?
      // Ideally we store the image path in the persona row, but plan implied strict storage structure.
      // Let's try to sign it. If it doesn't exist, the URL might 404, which we can handle in UI.
      const { data } = await supabase.storage
        .from("bucket")
        .createSignedUrl(path, 3600);

      return {
        ...p,
        imageUrl: data?.signedUrl || null,
      };
    })
  );

  return (
    <WorldView
      world={world}
      segments={segments || []}
      personas={personasWithImages}
      products={products || []}
    />
  );
}
