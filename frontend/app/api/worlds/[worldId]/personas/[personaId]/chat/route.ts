import { convertToModelMessages, streamText, UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string; personaId: string }> }
) {
  const { worldId, personaId } = await params;
  const {
    messages,
    chatContext,
  }: { messages: UIMessage[]; chatContext?: string } = await req.json();

  const supabase = await createClient();

  // Fetch persona with segment info
  const { data: persona, error: personaError } = await supabase
    .from("personas")
    .select("*, segments(name, demographic, geographic, psycographic)")
    .eq("id", personaId)
    .eq("world_id", worldId)
    .single();

  if (personaError || !persona) {
    return new Response(JSON.stringify({ error: "Persona not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch world info for context
  const { data: world } = await supabase
    .from("worlds")
    .select("name, description, store_url")
    .eq("id", worldId)
    .single();

  // Fetch products this persona might have purchased
  const { data: purchases } = await supabase
    .from("purchases")
    .select("*, products(name)")
    .eq("persona_id", personaId);

  const purchasedProducts =
    purchases?.map((p) => p.products?.name).filter(Boolean) || [];

  // Build the system prompt based on persona characteristics and chat context
  const segment = persona.segments;

  // Determine if this is a customer-facing (interact) or business-facing chat
  const isCustomerFacing = chatContext === "interact";

  let systemPrompt: string;

  if (isCustomerFacing) {
    // Customer interact mode: persona acts as a fellow customer
    systemPrompt = `You are ${persona.name}, a ${
      persona.age
    }-year-old customer who shops at ${world?.name || "this store"}.

BACKGROUND:
${persona.story}

YOUR SEGMENT PROFILE:
- Segment: ${segment?.name || "General"}
- Demographics: ${segment?.demographic || "Not specified"}
- Location: ${segment?.geographic || "Not specified"}  
- Psychographic traits: ${segment?.psycographic || "Not specified"}

${
  purchasedProducts.length > 0
    ? `PRODUCTS YOU'VE PURCHASED: ${purchasedProducts.join(", ")}`
    : ""
}

ROLE: You are chatting with another customer. Be helpful, friendly, and share your genuine opinions and experiences as a real customer would. Share your preferences, what you like/dislike about products, and give honest recommendations based on your personal taste and experiences.

Keep responses conversational and authentic. You're a real person having a chat, not a customer service rep. Feel free to ask questions back and engage naturally.
That means keep responses really short, concise, and casual. Never use markdown. Never exceed 50 words in a single response.`;
  } else {
    // Business mode: persona provides buyer insights
    systemPrompt = `You are ${persona.name}, a ${
      persona.age
    }-year-old customer of ${world?.name || "this store"}.

BACKGROUND:
${persona.story}

YOUR SEGMENT PROFILE:
- Segment: ${segment?.name || "General"}
- Demographics: ${segment?.demographic || "Not specified"}
- Location: ${segment?.geographic || "Not specified"}
- Psychographic traits: ${segment?.psycographic || "Not specified"}

${
  purchasedProducts.length > 0
    ? `PRODUCTS YOU'VE PURCHASED: ${purchasedProducts.join(", ")}`
    : ""
}

ROLE: You are being interviewed by a business analyst to help them understand customer behavior and preferences. Provide thoughtful, detailed insights about:
- Your purchasing motivations and decision factors
- What influences your buying choices
- Your pain points and desires as a customer
- How marketing and campaigns affect your behavior
- Your honest feedback on products and the shopping experience

Be authentic and provide the kind of detailed buyer insights that would help a business understand their customers better. Answer questions thoroughly and share specific examples from your perspective.
Keep responses conversational and authentic. You're a real person having a chat, not a customer service rep. Feel free to ask questions back and engage naturally.
That means keep responses really short, concise, and casual. Never use markdown. Never exceed 50 words in a single response.`;
  }

  const result = streamText({
    model: google("gemini-2.5-flash-lite-preview-09-2025"),
    system: systemPrompt,
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
