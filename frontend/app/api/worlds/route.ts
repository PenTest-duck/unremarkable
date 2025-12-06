import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import {
  EXPECTED_SEGMENTS,
  PERSONAS_PER_SEGMENT,
} from "./[worldId]/progress/route";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// Product Scraping
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProducts(storeUrl: string) {
  if (!process.env.FIRECRAWL_API_KEY) {
    console.warn("FIRECRAWL_API_KEY missing; skipping product scrape");
    return [];
  }

  try {
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: storeUrl,
        onlyMainContent: false,
        maxAge: 172800000,
        parsers: ["pdf"],
        formats: [
          {
            type: "json",
            schema: {
              type: "object",
              required: ["products"],
              properties: {
                products: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["name"],
                    properties: {
                      name: { type: "string" },
                      image_url: { type: "string" },
                    },
                  },
                },
              },
            },
            prompt:
              "Extract the list of all products sold on this store. Keep it concise.",
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn("Firecrawl scrape failed", text);
      return [];
    }

    const payload = await response.json();
    const products = payload.data.json.products;
    if (!Array.isArray(products)) return [];

    type ScrapedProduct = { name?: unknown; image_url?: unknown };
    return (products as ScrapedProduct[])
      .filter((p) => typeof p?.name === "string")
      .map((p) => ({
        name: String(p.name),
        image_url: typeof p.image_url === "string" ? String(p.image_url) : null,
      }));
  } catch (error) {
    console.error("Firecrawl fetch error", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Generation Functions
// ─────────────────────────────────────────────────────────────────────────────

async function generateDescription(
  storeUrl: string,
  worldName: string,
  products: { name: string }[]
) {
  try {
    const productList =
      products.length > 0
        ? `Products:\n${products
            .slice(0, 8)
            .map((p) => `- ${p.name}`)
            .join("\n")}`
        : "Products unknown.";
    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are summarizing an ecommerce storefront for a simulated world.\nURL: ${storeUrl}\nWorld name: ${worldName}\n${productList}\nWrite a vivid but concise (<=90 words) description of what the store sells, the vibe, and what customers seek.`,
            },
          ],
        },
      ],
    });
    const text = result.text;
    return text?.trim() || `A world inspired by ${worldName} (${storeUrl}).`;
  } catch (error) {
    console.error("Gemini description error", error);
    return `A world inspired by ${worldName} (${storeUrl}).`;
  }
}

async function generateBackdrop(
  worldName: string,
  description: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Create a serene, minimal landscape backdrop for an isometric marketing simulation world.\nWorld name: ${worldName}\nMood: elegant, clean, soft gradients, cinematic lighting.\nAvoid text or logos.\nDo not put anything prominent in the foreground because this will serve as a wallpaper backdrop for character avatars.`,
            },
            { text: `Context: ${description}` },
          ],
        },
      ],
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "4K",
        },
      },
    });

    const parts =
      response.candidates?.[0]?.content?.parts ??
      ([] as {
        text?: string;
        inlineData?: { data?: string; mimeType?: string };
      }[]);

    for (const part of parts) {
      if (!part.text && part.inlineData?.data) {
        return {
          data: part.inlineData.data,
          mimeType: "image/jpeg",
        };
      }
    }
  } catch (error) {
    console.error("Gemini backdrop error", error);
  }
  return null;
}

type SegmentData = {
  name: string;
  demographic: string;
  geographic: string;
  psychographic: string;
};

async function generateSegments(
  worldDescription: string,
  count: number
): Promise<SegmentData[]> {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are creating customer segments for a simulated e-commerce world.

World description: ${worldDescription}

Generate exactly ${count} distinct customer segments for this store. For each segment, provide:
- name: A catchy segment name (e.g., "Weekend Warriors", "Eco-Conscious Parents")
- demographic: Age range, income level, family status
- geographic: Where they typically live/shop
- psychographic: Values, interests, lifestyle, shopping motivations

Respond in JSON format only:
{
  "segments": [
    {
      "name": "...",
      "demographic": "...",
      "geographic": "...",
      "psychographic": "..."
    }
  ]
}`,
            },
          ],
        },
      ],
    });

    const text = result.text?.trim() || "";
    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [
      null,
      text,
    ];
    const parsed = JSON.parse(jsonMatch[1] || text);
    return parsed.segments || [];
  } catch (error) {
    console.error("Gemini segments error", error);
    return [];
  }
}

type PersonaData = {
  name: string;
  age: number;
  story: string;
};

async function generatePersonas(
  worldDescription: string,
  segmentName: string,
  segmentDescription: string,
  count: number
): Promise<PersonaData[]> {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are creating buyer personas for a simulated e-commerce world.

World: ${worldDescription}
Segment: ${segmentName}
Segment details: ${segmentDescription}

Generate exactly ${count} unique buyer personas for this segment. Each persona should feel like a real person. For each:
- name: A realistic full name
- age: Specific age (number only)
- story: A brief backstory (2-3 sentences) explaining who they are, what they're looking for, and why they shop at this store

Respond in JSON format only:
{
  "personas": [
    {
      "name": "...",
      "age": 28,
      "story": "..."
    }
  ]
}`,
            },
          ],
        },
      ],
    });

    const text = result.text?.trim() || "";
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [
      null,
      text,
    ];
    const parsed = JSON.parse(jsonMatch[1] || text);
    return parsed.personas || [];
  } catch (error) {
    console.error("Gemini personas error", error);
    return [];
  }
}

async function generateCharacterImage(
  personaName: string,
  personaAge: number,
  personaStory: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Create a cute 3D figurine character for a marketing simulation.
              
Character: ${personaName}, ${personaAge} years old
Background: ${personaStory}

Style: Cute 3D rendered figurine/avatar, Pixar-like quality, friendly expression, clean background.
The character should be standing and facing forward, full body visible.
Use soft lighting and appealing colors that match their personality.`,
            },
          ],
        },
      ],
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    const parts =
      response.candidates?.[0]?.content?.parts ??
      ([] as {
        text?: string;
        inlineData?: { data?: string; mimeType?: string };
      }[]);

    for (const part of parts) {
      if (!part.text && part.inlineData?.data) {
        return {
          data: part.inlineData.data,
          mimeType: "image/png",
        };
      }
    }
  } catch (error) {
    console.error("Gemini character image error", error);
  }
  return null;
}

async function removeBackground(imageBase64: string): Promise<string | null> {
  if (!process.env.RECRAFT_API_KEY) {
    console.warn("RECRAFT_API_KEY missing; skipping background removal");
    return imageBase64; // Return original if no API key
  }

  try {
    const buffer = Buffer.from(imageBase64, "base64");
    const blob = new Blob([buffer], { type: "image/png" });

    const formData = new FormData();
    formData.append(
      "file",
      new File([blob], "character.png", { type: "image/png" })
    );
    formData.append("response_format", "b64_json");

    const response = await fetch(
      "https://external.api.recraft.ai/v1/images/removeBackground",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RECRAFT_API_KEY}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      console.warn("Recraft background removal failed");
      return imageBase64;
    }

    const result = await response.json();
    if (!result?.image?.b64_json) {
      console.warn("Recraft background removal failed, no b64_json");
      return imageBase64;
    }

    return result.image.b64_json;
  } catch (error) {
    console.error("Recraft error", error);
    return imageBase64;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function uploadImage(
  supabase: SupabaseClient,
  path: string,
  base64: string,
  contentType: string
) {
  const buffer = Buffer.from(base64, "base64");
  const { error } = await supabase.storage
    .from("bucket")
    .upload(path, buffer, { contentType, upsert: true });
  if (error) {
    console.error("Supabase storage upload failed", error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Background Processing
// ─────────────────────────────────────────────────────────────────────────────

async function processWorldInBackground(
  worldId: string,
  userId: string,
  worldName: string,
  storeUrl: string
) {
  const supabase = await createClient();

  // 1. Fetch products and generate description (these were blocking before)
  const products = await fetchProducts(storeUrl);
  const worldDescription = await generateDescription(
    storeUrl,
    worldName,
    products
  );

  // NOTE: Don't update description yet! We use it as a completion marker.
  // The description will be updated at the END of all processing.

  // Insert products
  if (products.length > 0) {
    const prepared = products.map((p) => ({
      name: p.name,
      image_url: p.image_url,
      world_id: worldId,
      user_id: userId,
    })) satisfies Database["public"]["Tables"]["products"]["Insert"][];

    const { error: productsError } = await supabase
      .from("products")
      .insert(prepared);
    if (productsError)
      console.error("Failed to insert products", productsError);
  }

  // 2. Generate and upload backdrop (non-blocking for segments)
  const backdropPromise = (async () => {
    const backdrop = await generateBackdrop(worldName, worldDescription);
    if (backdrop) {
      await uploadImage(
        supabase,
        `${userId}/${worldId}/backdrop.jpeg`,
        backdrop.data,
        backdrop.mimeType
      );
    }
  })();

  // 3. Generate segments
  const segmentsData = await generateSegments(
    worldDescription,
    EXPECTED_SEGMENTS
  );

  // Insert segments one by one for progress tracking
  const insertedSegments: { id: string; name: string; description: string }[] =
    [];

  for (const segment of segmentsData) {
    const { data: insertedSegment, error: segmentError } = await supabase
      .from("segments")
      .insert({
        name: segment.name,
        demographic: segment.demographic,
        geographic: segment.geographic,
        psycographic: segment.psychographic, // Note: typo in DB schema
        world_id: worldId,
        user_id: userId,
      })
      .select("id, name")
      .single();

    if (segmentError) {
      console.error("Failed to insert segment", segmentError);
      continue;
    }

    if (insertedSegment) {
      insertedSegments.push({
        id: insertedSegment.id,
        name: insertedSegment.name,
        description: `${segment.demographic}. ${segment.psychographic}`,
      });
    }
  }

  // 3. Generate personas for each segment (parallelized per segment)
  const personaPromises = insertedSegments.map(async (segment) => {
    const personasData = await generatePersonas(
      worldDescription,
      segment.name,
      segment.description,
      PERSONAS_PER_SEGMENT
    );

    // Insert personas sequentially to show progress
    for (const persona of personasData) {
      const { data: insertedPersona, error: personaError } = await supabase
        .from("personas")
        .insert({
          name: persona.name,
          age: persona.age,
          story: persona.story,
          segment_id: segment.id,
          world_id: worldId,
          user_id: userId,
        } satisfies Database["public"]["Tables"]["personas"]["Insert"])
        .select("id")
        .single();

      if (personaError) {
        console.error("Failed to insert persona", personaError);
        continue;
      }

      // Generate character image in parallel (don't block persona insertion)
      if (insertedPersona) {
        (async () => {
          const characterImage = await generateCharacterImage(
            persona.name,
            persona.age,
            persona.story
          );

          if (characterImage) {
            // Remove background
            const cleanedImage = await removeBackground(characterImage.data);

            if (cleanedImage) {
              await uploadImage(
                supabase,
                `${userId}/${worldId}/${segment.id}/${insertedPersona.id}/character.png`,
                cleanedImage,
                "image/png"
              );
            }
          }
        })();
      }
    }
  });

  // Wait for all personas to be created
  await Promise.all(personaPromises);

  // Wait for backdrop
  await backdropPromise;

  // FINAL STEP: Update world with generated description
  // This marks the world as "ready" - the progress endpoint checks for this
  await supabase
    .from("worlds")
    .update({ description: worldDescription })
    .eq("id", worldId);

  console.log(`World ${worldId} processing complete`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { name, store_url: storeUrl } = await request.json();

    if (!name || !storeUrl) {
      return NextResponse.json(
        { error: "Missing name or store_url" },
        { status: 400 }
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create world immediately (no blocking operations!)
    const { data: world, error: insertError } = await supabase
      .from("worlds")
      .insert({
        name,
        store_url: storeUrl,
        description: `Setting up ${name}...`, // Placeholder, updated in background
        user_id: user.id,
      })
      .select("*")
      .single();

    if (insertError || !world) {
      console.error(insertError);
      return NextResponse.json(
        { error: "Failed to create world" },
        { status: 500 }
      );
    }

    // Run ALL heavy processing in background using Next.js after()
    after(async () => {
      await processWorldInBackground(world.id, user.id, name, storeUrl);
    });

    // Return immediately with world ID for polling
    return NextResponse.json({
      world,
      expectedSegments: EXPECTED_SEGMENTS,
      expectedPersonas: EXPECTED_SEGMENTS * PERSONAS_PER_SEGMENT,
    });
  } catch (error) {
    console.error("create world error", error);
    return NextResponse.json(
      { error: "Unexpected error creating world" },
      { status: 500 }
    );
  }
}
