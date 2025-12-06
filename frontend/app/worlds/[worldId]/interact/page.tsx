import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { InteractCanvas } from "@/components/worlds/interact-canvas";

export default async function InteractPage({
  params,
}: {
  params: Promise<{ worldId: string }>;
}) {
  const { worldId } = await params;
  const supabase = await createClient();

  // Fetch world details
  const { data: world, error: worldError } = await supabase
    .from("worlds")
    .select("*")
    .eq("id", worldId)
    .single();

  if (worldError || !world) {
    notFound();
  }

  // Fetch personas with segments
  const { data: personas } = await supabase
    .from("personas")
    .select("*, segments(name)")
    .eq("world_id", worldId);

  // Generate presigned URLs for personas and backdrop
  // Backdrop path: /{userId}/{worldId}/backdrop.png
  // Persona path: /{userId}/{worldId}/{segmentId}/{personaId}/character.png
  // Assuming user_id on world row is the creator

  const creatorId = world.user_id;

  const backdropPath = `${creatorId}/${worldId}/backdrop.jpeg`;
  const { data: backdropData } = await supabase.storage
    .from("bucket")
    .createSignedUrl(backdropPath, 3600);

  const personasWithImages = await Promise.all(
    (personas || []).map(async (p) => {
      const path = `${creatorId}/${worldId}/${p.segment_id}/${p.id}/character.png`;
      const { data } = await supabase.storage
        .from("bucket")
        .createSignedUrl(path, 3600);

      return {
        ...p,
        imageUrl: data?.signedUrl || null,
        // Use simple hash of ID for deterministic position
        x: (p.id.charCodeAt(0) % 80) + 10,
        y: (p.id.charCodeAt(p.id.length - 1) % 60) + 20,
      };
    })
  );

  return (
    <InteractCanvas
      world={{ ...world, backdropUrl: backdropData?.signedUrl || null }}
      personas={personasWithImages}
    />
  );
}
