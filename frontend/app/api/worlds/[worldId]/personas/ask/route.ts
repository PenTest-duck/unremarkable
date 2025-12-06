import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Allow up to 60 seconds for this endpoint (multiple AI calls)
export const maxDuration = 60;

type PersonaWithSegment = {
  id: string;
  name: string;
  age: number;
  story: string;
  segments: {
    name: string;
    demographic: string;
    geographic: string;
    psycographic: string;
  } | null;
};

type Product = {
  id: string;
  name: string;
  image_url: string | null;
};

// Router AI: Determines which personas are most relevant to answer the question
async function routeQuestion(
  question: string,
  personas: PersonaWithSegment[],
  products: Product[]
): Promise<string[]> {
  const personaSummaries = personas.map((p) => ({
    id: p.id,
    name: p.name,
    age: p.age,
    segment: p.segments?.name || "General",
    demographic: p.segments?.demographic || "",
    psychographic: p.segments?.psycographic || "",
    story: p.story,
  }));

  const productList = products.map((p) => p.name).join(", ");

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a routing assistant that determines which customer personas are best suited to answer a question.

AVAILABLE PERSONAS:
${JSON.stringify(personaSummaries, null, 2)}

AVAILABLE PRODUCTS IN THIS STORE:
${productList || "No products listed"}

USER QUESTION:
"${question}"

Your task: Select up to 3 personas whose backgrounds, demographics, or interests make them most relevant to answer this question. Consider:
- Age relevance (e.g., teenager questions → younger personas)
- Experience level mentioned in their story
- Psychographic traits that match the question topic
- Segment demographics that align with the question

If no personas are particularly relevant, return an empty array.

Respond with ONLY a JSON array of persona IDs, like: ["id1", "id2"]
Maximum 3 IDs. Empty array [] if none match well.`,
            },
          ],
        },
      ],
    });

    const text = result.text?.trim() || "[]";
    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*?\]/) || ["[]"];
    const selectedIds = JSON.parse(jsonMatch[0]) as string[];

    // Validate that returned IDs exist
    const validIds = selectedIds.filter((id) =>
      personas.some((p) => p.id === id)
    );
    return validIds.slice(0, 3);
  } catch (error) {
    console.error("Router AI error:", error);
    return [];
  }
}

// Get a single persona's response to the question
async function getPersonaResponse(
  persona: PersonaWithSegment,
  question: string,
  products: Product[]
): Promise<{ personaId: string; personaName: string; response: string }> {
  const productList =
    products.length > 0
      ? products.map((p) => `- ${p.name}`).join("\n")
      : "No specific products listed";

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are ${persona.name}, a ${
                persona.age
              }-year-old customer.

YOUR BACKGROUND:
${persona.story}

YOUR PROFILE:
- Segment: ${persona.segments?.name || "General"}
- Demographics: ${persona.segments?.demographic || "Not specified"}
- Location: ${persona.segments?.geographic || "Not specified"}
- Personality & Interests: ${persona.segments?.psycographic || "Not specified"}

PRODUCTS AVAILABLE AT THIS STORE:
${productList}

A fellow shopper is asking for your opinion:
"${question}"

Respond naturally as yourself, sharing your genuine perspective based on your background and experiences. If relevant, mention specific products from the store. Keep your response concise (2-4 sentences), conversational, and helpful.`,
            },
          ],
        },
      ],
    });

    return {
      personaId: persona.id,
      personaName: persona.name,
      response: result.text?.trim() || "I'm not sure how to answer that.",
    };
  } catch (error) {
    console.error(`Persona ${persona.name} response error:`, error);
    return {
      personaId: persona.id,
      personaName: persona.name,
      response: "I couldn't form an opinion on that right now.",
    };
  }
}

// Aggregator AI: Combines multiple persona responses into a coherent answer
async function aggregateResponses(
  question: string,
  responses: { personaName: string; response: string }[],
  products: Product[]
): Promise<string> {
  const productList =
    products.length > 0
      ? products.map((p) => p.name).join(", ")
      : "various products";

  // If no personas were selected, generate a general response
  if (responses.length === 0) {
    try {
      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are a helpful shopping assistant for a store that sells: ${productList}.

A customer asks: "${question}"

Provide a helpful, general response since we don't have specific customer personas that match this question well. Be friendly and informative, mentioning relevant products if applicable. Keep it concise (2-4 sentences).`,
              },
            ],
          },
        ],
      });
      return result.text?.trim() || "I'd be happy to help with that question!";
    } catch (error) {
      console.error("General response error:", error);
      return "I'd be happy to help with that question! Feel free to browse our products or ask a more specific question.";
    }
  }

  // Aggregate multiple persona responses
  const personaInputs = responses
    .map((r) => `${r.personaName}: "${r.response}"`)
    .join("\n\n");

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are synthesizing customer opinions to answer a shopper's question.

ORIGINAL QUESTION:
"${question}"

CUSTOMER PERSPECTIVES:
${personaInputs}

STORE PRODUCTS:
${productList}

Create a unified, helpful response that:
1. Synthesizes the key insights from these customers
2. Attributes opinions to specific customers when relevant (e.g., "Sarah, who's been skiing for years, recommends...")
3. Highlights any consensus or interesting differences in opinion
4. Mentions specific products if the customers referenced them
5. Keeps the tone friendly and conversational

Keep the response concise but informative (3-5 sentences). Don't use bullet points or formal structure.`,
            },
          ],
        },
      ],
    });

    return (
      result.text?.trim() ||
      responses.map((r) => `${r.personaName} says: ${r.response}`).join(" ")
    );
  } catch (error) {
    console.error("Aggregator AI error:", error);
    // Fallback: just concatenate responses
    return responses
      .map((r) => `${r.personaName} says: "${r.response}"`)
      .join(" ");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { worldId } = await params;

  try {
    const { question } = await req.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid question" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch all personas for this world with their segment info
    const { data: personas, error: personasError } = await supabase
      .from("personas")
      .select(
        "id, name, age, story, segments(name, demographic, geographic, psycographic)"
      )
      .eq("world_id", worldId);

    if (personasError) {
      console.error("Failed to fetch personas:", personasError);
      return NextResponse.json(
        { error: "Failed to fetch personas" },
        { status: 500 }
      );
    }

    // Fetch products for this world
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, image_url")
      .eq("world_id", worldId);

    if (productsError) {
      console.error("Failed to fetch products:", productsError);
      return NextResponse.json(
        { error: "Failed to fetch products" },
        { status: 500 }
      );
    }

    const typedPersonas = (personas || []) as PersonaWithSegment[];
    const typedProducts = (products || []) as Product[];

    // Step 1: Route the question to relevant personas
    const selectedPersonaIds = await routeQuestion(
      question,
      typedPersonas,
      typedProducts
    );

    // Step 2: Get responses from selected personas (in parallel)
    const selectedPersonas = typedPersonas.filter((p) =>
      selectedPersonaIds.includes(p.id)
    );

    const personaResponses = await Promise.all(
      selectedPersonas.map((persona) =>
        getPersonaResponse(persona, question, typedProducts)
      )
    );

    // Step 3: Aggregate responses into a single answer
    const aggregatedResponse = await aggregateResponses(
      question,
      personaResponses,
      typedProducts
    );

    return NextResponse.json({
      answer: aggregatedResponse,
      sourcedFrom: personaResponses.map((r) => ({
        personaId: r.personaId,
        personaName: r.personaName,
        response: r.response,
      })),
      totalPersonasConsidered: typedPersonas.length,
    });
  } catch (error) {
    console.error("Ask endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to process question" },
      { status: 500 }
    );
  }
}
