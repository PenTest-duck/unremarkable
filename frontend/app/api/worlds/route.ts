import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { name, store_url } = await request.json();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("worlds")
    .insert({ name, store_url });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
