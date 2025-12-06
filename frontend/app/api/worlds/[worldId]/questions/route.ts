import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { worldId } = await params;
  const supabase = await createClient();

  // Fetch customer questions for this world, ordered by 'order' field
  const { data: questions, error } = await supabase
    .from("customer_questions")
    .select("id, question, order")
    .eq("world_id", worldId)
    .order("order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    );
  }

  return NextResponse.json({ questions: questions || [] });
}

