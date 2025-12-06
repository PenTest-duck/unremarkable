import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Allow up to 120 seconds for this endpoint (many parallel AI calls)
export const maxDuration = 120;

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

type Campaign = {
  id: string;
  content: string;
};

type FeedbackResult = {
  personaId: string;
  personaName: string;
  campaignId: string;
  rating: number;
  feedback: string;
};

// Have a persona evaluate a campaign and provide rating + feedback
async function evaluateCampaign(
  persona: PersonaWithSegment,
  campaign: Campaign,
  productName: string
): Promise<{ rating: number; feedback: string }> {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are ${persona.name}, a ${persona.age}-year-old customer evaluating a marketing campaign.

YOUR BACKGROUND:
${persona.story}

YOUR PROFILE:
- Segment: ${persona.segments?.name || "General"}
- Demographics: ${persona.segments?.demographic || "Not specified"}
- Location: ${persona.segments?.geographic || "Not specified"}
- Personality & Interests: ${persona.segments?.psycographic || "Not specified"}

PRODUCT BEING ADVERTISED: ${productName}

CAMPAIGN CONTENT (Instagram-style post):
"${campaign.content}"

As this customer, evaluate this marketing campaign. Consider:
- Does this appeal to someone like you?
- Is the messaging relevant to your needs and interests?
- Would this make you want to learn more or purchase?
- Does the tone resonate with you?

Provide:
1. A rating from 0-5 (0 = terrible/irrelevant, 5 = amazing/very compelling)
2. A brief, authentic feedback (1-2 sentences) from your perspective

Respond in JSON format only:
{
  "rating": 3,
  "feedback": "Your honest feedback as this persona..."
}`,
            },
          ],
        },
      ],
    });

    const text = result.text?.trim() || "";
    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const parsed = JSON.parse(jsonMatch[1] || text);
    
    return {
      rating: Math.min(5, Math.max(0, Math.round(parsed.rating || 0))),
      feedback: parsed.feedback || "No feedback provided.",
    };
  } catch (error) {
    console.error(`Evaluation error for persona ${persona.name}:`, error);
    return {
      rating: 2,
      feedback: "Unable to evaluate this campaign.",
    };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { worldId } = await params;

  try {
    const { campaignIds, prompt, productName } = await req.json();

    if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid campaignIds" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all personas for this world with their segment info
    const { data: personas, error: personasError } = await supabase
      .from("personas")
      .select(
        "id, name, age, story, segments(name, demographic, geographic, psycographic)"
      )
      .eq("world_id", worldId);

    if (personasError || !personas || personas.length === 0) {
      return NextResponse.json(
        { error: "No personas found for this world" },
        { status: 404 }
      );
    }

    // Fetch the campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, content")
      .in("id", campaignIds);

    if (campaignsError || !campaigns || campaigns.length === 0) {
      return NextResponse.json(
        { error: "Campaigns not found" },
        { status: 404 }
      );
    }

    // Create a simulation record (using first campaignId as required by schema)
    const { data: simulation, error: simulationError } = await supabase
      .from("simulations")
      .insert({
        campaign_id: campaignIds[0],
        prompt: prompt || "Evaluate campaigns",
        world_id: worldId,
        user_id: user.id,
      })
      .select("*")
      .single();

    if (simulationError || !simulation) {
      console.error("Failed to create simulation", simulationError);
      return NextResponse.json(
        { error: "Failed to create simulation" },
        { status: 500 }
      );
    }

    const typedPersonas = personas as PersonaWithSegment[];
    const typedCampaigns = campaigns as Campaign[];

    // Create all persona x campaign evaluation tasks
    const evaluationTasks: Promise<FeedbackResult>[] = [];

    for (const persona of typedPersonas) {
      for (const campaign of typedCampaigns) {
        evaluationTasks.push(
          (async () => {
            const evaluation = await evaluateCampaign(
              persona,
              campaign,
              productName || "the product"
            );
            return {
              personaId: persona.id,
              personaName: persona.name,
              campaignId: campaign.id,
              rating: evaluation.rating,
              feedback: evaluation.feedback,
            };
          })()
        );
      }
    }

    // Run all evaluations in parallel
    const feedbackResults = await Promise.all(evaluationTasks);

    // Insert all feedbacks into the database
    const feedbackInserts = feedbackResults.map((result) => ({
      campaign_id: result.campaignId,
      persona_id: result.personaId,
      simulation_id: simulation.id,
      rating: result.rating,
      feedback: result.feedback,
      world_id: worldId,
      user_id: user.id,
    }));

    const { error: feedbackError } = await supabase
      .from("feedbacks")
      .insert(feedbackInserts);

    if (feedbackError) {
      console.error("Failed to insert feedbacks", feedbackError);
      return NextResponse.json(
        { error: "Failed to save feedback results" },
        { status: 500 }
      );
    }

    // Group results by campaign for easier frontend consumption
    const resultsByCampaign: Record<
      string,
      {
        campaignId: string;
        averageRating: number;
        feedbacks: { personaId: string; personaName: string; rating: number; feedback: string }[];
      }
    > = {};

    for (const result of feedbackResults) {
      if (!resultsByCampaign[result.campaignId]) {
        resultsByCampaign[result.campaignId] = {
          campaignId: result.campaignId,
          averageRating: 0,
          feedbacks: [],
        };
      }
      resultsByCampaign[result.campaignId].feedbacks.push({
        personaId: result.personaId,
        personaName: result.personaName,
        rating: result.rating,
        feedback: result.feedback,
      });
    }

    // Calculate average ratings
    for (const campaignId of Object.keys(resultsByCampaign)) {
      const feedbacks = resultsByCampaign[campaignId].feedbacks;
      const totalRating = feedbacks.reduce((sum, f) => sum + f.rating, 0);
      resultsByCampaign[campaignId].averageRating =
        Math.round((totalRating / feedbacks.length) * 10) / 10;
    }

    return NextResponse.json({
      simulationId: simulation.id,
      results: Object.values(resultsByCampaign),
      totalEvaluations: feedbackResults.length,
      personaCount: typedPersonas.length,
      campaignCount: typedCampaigns.length,
    });
  } catch (error) {
    console.error("Simulation error:", error);
    return NextResponse.json(
      { error: "Failed to run simulation" },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch simulation results
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { worldId } = await params;
  const { searchParams } = new URL(req.url);
  const simulationId = searchParams.get("simulationId");

  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (simulationId) {
      // Fetch specific simulation results
      const { data: feedbacks, error: feedbacksError } = await supabase
        .from("feedbacks")
        .select("*, personas(name)")
        .eq("simulation_id", simulationId)
        .eq("world_id", worldId);

      if (feedbacksError) {
        return NextResponse.json(
          { error: "Failed to fetch simulation results" },
          { status: 500 }
        );
      }

      // Group by campaign
      const resultsByCampaign: Record<
        string,
        {
          campaignId: string;
          averageRating: number;
          feedbacks: { personaId: string; personaName: string; rating: number; feedback: string }[];
        }
      > = {};

      for (const fb of feedbacks || []) {
        if (!resultsByCampaign[fb.campaign_id]) {
          resultsByCampaign[fb.campaign_id] = {
            campaignId: fb.campaign_id,
            averageRating: 0,
            feedbacks: [],
          };
        }
        resultsByCampaign[fb.campaign_id].feedbacks.push({
          personaId: fb.persona_id,
          personaName: (fb.personas as { name: string } | null)?.name || "Unknown",
          rating: fb.rating,
          feedback: fb.feedback,
        });
      }

      // Calculate average ratings
      for (const campaignId of Object.keys(resultsByCampaign)) {
        const feedbacksList = resultsByCampaign[campaignId].feedbacks;
        const totalRating = feedbacksList.reduce((sum, f) => sum + f.rating, 0);
        resultsByCampaign[campaignId].averageRating =
          Math.round((totalRating / feedbacksList.length) * 10) / 10;
      }

      return NextResponse.json({
        simulationId,
        results: Object.values(resultsByCampaign),
      });
    }

    // Fetch all simulations for this world
    const { data: simulations, error: simulationsError } = await supabase
      .from("simulations")
      .select("*")
      .eq("world_id", worldId)
      .order("created_at", { ascending: false });

    if (simulationsError) {
      return NextResponse.json(
        { error: "Failed to fetch simulations" },
        { status: 500 }
      );
    }

    return NextResponse.json({ simulations: simulations || [] });
  } catch (error) {
    console.error("Fetch simulations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch simulations" },
      { status: 500 }
    );
  }
}

