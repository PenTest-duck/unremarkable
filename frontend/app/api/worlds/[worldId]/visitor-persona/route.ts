import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// Visitor Persona Generation
// ─────────────────────────────────────────────────────────────────────────────

type VisitorPersonaData = {
  name: string;
  age: number;
  story: string;
  traits: string[];
};

async function generateVisitorPersona(
  worldDescription: string,
  questions: { question: string; answer: string }[]
): Promise<VisitorPersonaData> {
  try {
    const qaText = questions
      .map((q) => `Q: ${q.question}\nA: ${q.answer}`)
      .join("\n\n");

    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are creating a buyer persona based on a visitor's answers to onboarding questions.

Store/World context: ${worldDescription}

The visitor answered these questions:
${qaText}

Based on their answers, create a fun, relatable buyer persona for them. Generate:
- name: A fun first name that fits their vibe (creative, not generic)
- age: An estimated age (number) based on their answers
- story: A 2-sentence persona description written in third person, capturing who they are as a customer
- traits: 3-4 short trait keywords (e.g., "bargain hunter", "early adopter", "quality-focused")

Respond in JSON format only:
{
  "name": "...",
  "age": 28,
  "story": "...",
  "traits": ["...", "...", "..."]
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
    return {
      name: parsed.name || "Curious Shopper",
      age: parsed.age || 25,
      story: parsed.story || "A visitor exploring the store for the first time.",
      traits: parsed.traits || ["curious", "exploring"],
    };
  } catch (error) {
    console.error("Gemini visitor persona error", error);
    return {
      name: "Curious Shopper",
      age: 25,
      story: "A visitor exploring the store for the first time, eager to discover new products.",
      traits: ["curious", "exploring"],
    };
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
              text: `Create a cute 3D figurine character for a visitor persona.
              
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
    return imageBase64;
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
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { worldId } = await params;
  const { answers } = await request.json();

  // answers: [{ question: string, answer: string }]
  if (!answers || !Array.isArray(answers)) {
    return NextResponse.json(
      { error: "Missing or invalid answers" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Fetch world info
  const { data: world, error: worldError } = await supabase
    .from("worlds")
    .select("id, name, description, user_id")
    .eq("id", worldId)
    .single();

  if (worldError || !world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  // Generate the visitor persona
  const personaData = await generateVisitorPersona(
    world.description || world.name,
    answers
  );

  // Generate character image
  const characterImage = await generateCharacterImage(
    personaData.name,
    personaData.age,
    personaData.story
  );

  let imageBase64: string | null = null;
  if (characterImage) {
    // Remove background
    imageBase64 = await removeBackground(characterImage.data);
  }

  // Return the persona data with the image as base64
  // We don't store visitor personas in the database - they're ephemeral
  return NextResponse.json({
    persona: {
      name: personaData.name,
      age: personaData.age,
      story: personaData.story,
      traits: personaData.traits,
      imageBase64: imageBase64
        ? `data:image/png;base64,${imageBase64}`
        : null,
    },
  });
}

