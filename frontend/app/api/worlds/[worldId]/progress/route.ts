import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Expected counts for progress tracking
export const EXPECTED_SEGMENTS = 1; // 4
export const PERSONAS_PER_SEGMENT = 1; // 4
export const EXPECTED_PERSONAS = EXPECTED_SEGMENTS * PERSONAS_PER_SEGMENT;

// Placeholder prefix used when world is first created (before background processing completes)
export const SETUP_PLACEHOLDER_PREFIX = "Setting up";

export type ProgressStep = {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "complete" | "error";
  current?: number;
  total?: number;
};

export type ProgressResponse = {
  worldId: string;
  steps: ProgressStep[];
  isComplete: boolean;
  error?: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { worldId } = await params;

  const supabase = await createClient();

  // Check world exists and get description
  const { data: world, error: worldError } = await supabase
    .from("worlds")
    .select("id, name, description")
    .eq("id", worldId)
    .single();

  if (worldError || !world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  // Check if description is still the placeholder (background not done with initial setup)
  const isDescriptionReady = Boolean(
    world.description && !world.description.startsWith(SETUP_PLACEHOLDER_PREFIX)
  );

  // Count segments
  const { count: segmentCount } = await supabase
    .from("segments")
    .select("*", { count: "exact", head: true })
    .eq("world_id", worldId);

  // Count personas
  const { count: personaCount } = await supabase
    .from("personas")
    .select("*", { count: "exact", head: true })
    .eq("world_id", worldId);

  const segments = segmentCount ?? 0;
  const personas = personaCount ?? 0;

  // Step 1: Creating world (includes fetching products & generating description)
  // Complete only when description is no longer the placeholder
  const worldSetupComplete = isDescriptionReady;

  // Determine step statuses
  const steps: ProgressStep[] = [
    {
      id: "world",
      label: "Creating the world",
      status: worldSetupComplete ? "complete" : "in_progress",
    },
    {
      id: "segments",
      label: "Creating customer segments",
      status:
        segments >= EXPECTED_SEGMENTS
          ? "complete"
          : segments > 0
          ? "in_progress"
          : worldSetupComplete
          ? "in_progress"
          : "pending",
      current: segments,
      total: EXPECTED_SEGMENTS,
    },
    {
      id: "personas",
      label: "Creating buyer personas",
      status:
        personas >= EXPECTED_PERSONAS
          ? "complete"
          : personas > 0
          ? "in_progress"
          : segments >= EXPECTED_SEGMENTS
          ? "in_progress"
          : "pending",
      current: personas,
      total: EXPECTED_PERSONAS,
    },
  ];

  // Only complete when ALL conditions are met:
  // 1. Description is generated (not placeholder)
  // 2. All segments created
  // 3. All personas created
  const isComplete =
    isDescriptionReady &&
    segments >= EXPECTED_SEGMENTS &&
    personas >= EXPECTED_PERSONAS;

  const response: ProgressResponse = {
    worldId,
    steps,
    isComplete,
  };

  return NextResponse.json(response);
}
