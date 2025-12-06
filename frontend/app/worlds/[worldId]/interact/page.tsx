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

  // Generate better distributed positions for personas
  const generateSpreadPosition = (id: string, index: number) => {
    // Create a more sophisticated hash from the ID
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Use golden ratio for better distribution
    const goldenRatio = 0.618033988749895;
    const angle = (index * goldenRatio) % 1;

    // Combine hash and angle for more spread out positions
    const hashX = Math.abs(hash % 100) / 100;
    const hashY = Math.abs((hash * 7) % 100) / 100;

    // Use spiral-like distribution combined with hash
    const spiralX = Math.cos(angle * Math.PI * 2) * 0.3 + 0.5;
    const spiralY = Math.sin(angle * Math.PI * 2) * 0.3 + 0.5;

    // Blend hash and spiral for natural spread
    const x = (hashX * 0.4 + spiralX * 0.6) * 0.75 + 0.125; // 12.5% to 87.5%
    const y = (hashY * 0.4 + spiralY * 0.6) * 0.65 + 0.175; // 17.5% to 82.5%

    return {
      x: x * 100,
      y: y * 100,
    };
  };

  const personasList = personas || [];
  const personasWithImages = await Promise.all(
    personasList.map(async (p, index) => {
      const path = `${creatorId}/${worldId}/${p.segment_id}/${p.id}/character.png`;
      const { data } = await supabase.storage
        .from("bucket")
        .createSignedUrl(path, 3600);

      const position = generateSpreadPosition(p.id, index);

      return {
        ...p,
        imageUrl: data?.signedUrl || null,
        x: position.x,
        y: position.y,
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
