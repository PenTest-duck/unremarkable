import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Allow up to 120 seconds for this endpoint (multiple AI calls for text + images)
export const maxDuration = 120;

type CampaignIdea = {
  content: string;
  imagePrompt: string;
};

// Generate campaign text ideas using Gemini Flash
async function generateCampaignIdeas(
  productName: string,
  productImageUrl: string | null,
  prompt: string,
  count: number
): Promise<CampaignIdea[]> {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a creative marketing expert creating Instagram-style promotional campaigns.

PRODUCT: ${productName}
${productImageUrl ? `PRODUCT IMAGE: ${productImageUrl}` : ""}

USER DIRECTIVE: ${prompt}

Generate exactly ${count} unique, creative campaign ideas. Each campaign should be like an Instagram post with:
- Short, punchy text content (2-4 sentences max, can include hashtags and emojis)
- An image prompt that describes what the campaign image should look like

Make each campaign distinctly different in tone and approach:
- One could be aspirational/lifestyle focused
- One could be practical/benefits focused  
- One could be emotional/story-driven
- One could be trendy/cultural moment focused

Respond in JSON format only:
{
  "campaigns": [
    {
      "content": "Your Instagram post caption here...",
      "imagePrompt": "Detailed prompt for generating the campaign image..."
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
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const parsed = JSON.parse(jsonMatch[1] || text);
    return parsed.campaigns || [];
  } catch (error) {
    console.error("Gemini campaign ideas error", error);
    return [];
  }
}

// Generate campaign image using Gemini Pro Image Preview
async function generateCampaignImage(
  productName: string,
  content: string,
  imagePrompt: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Create a professional marketing campaign image for Instagram.

PRODUCT: ${productName}
CAMPAIGN MESSAGE: ${content}
IMAGE DIRECTION: ${imagePrompt}

Style: Modern, high-quality, Instagram-worthy, visually striking.
The image should feel like a real brand's promotional content.
Do NOT include any text in the image - the caption will be separate.
Make it aspirational and on-brand.`,
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
          mimeType: "image/jpeg",
        };
      }
    }
  } catch (error) {
    console.error("Gemini campaign image error", error);
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { worldId } = await params;

  try {
    const { productId, prompt, count = 4 } = await req.json();

    if (!productId || !prompt) {
      return NextResponse.json(
        { error: "Missing productId or prompt" },
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

    // Fetch the product
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("world_id", worldId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Step 1: Generate campaign text ideas
    const campaignIdeas = await generateCampaignIdeas(
      product.name,
      product.image_url,
      prompt,
      count
    );

    if (campaignIdeas.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate campaign ideas" },
        { status: 500 }
      );
    }

    // Step 2: Insert campaigns into database and generate images in parallel
    const campaignResults = await Promise.all(
      campaignIdeas.map(async (idea) => {
        // Insert campaign into database
        const { data: campaign, error: insertError } = await supabase
          .from("campaigns")
          .insert({
            content: idea.content,
            world_id: worldId,
            user_id: user.id,
          })
          .select("*")
          .single();

        if (insertError || !campaign) {
          console.error("Failed to insert campaign", insertError);
          return null;
        }

        // Generate image for this campaign
        const image = await generateCampaignImage(
          product.name,
          idea.content,
          idea.imagePrompt
        );

        let imageUrl: string | null = null;

        if (image) {
          // Upload to Supabase storage
          const path = `${user.id}/${worldId}/campaigns/${campaign.id}/media/image.jpeg`;
          const buffer = Buffer.from(image.data, "base64");

          const { error: uploadError } = await supabase.storage
            .from("bucket")
            .upload(path, buffer, { contentType: image.mimeType, upsert: true });

          if (uploadError) {
            console.error("Failed to upload campaign image", uploadError);
          } else {
            // Get signed URL for the uploaded image
            const { data: signedUrlData } = await supabase.storage
              .from("bucket")
              .createSignedUrl(path, 3600);

            imageUrl = signedUrlData?.signedUrl || null;
          }
        }

        return {
          id: campaign.id,
          content: campaign.content,
          imageUrl,
          createdAt: campaign.created_at,
        };
      })
    );

    // Filter out any failed campaigns
    const successfulCampaigns = campaignResults.filter(
      (c): c is NonNullable<typeof c> => c !== null
    );

    return NextResponse.json({
      campaigns: successfulCampaigns,
      productId,
      worldId,
    });
  } catch (error) {
    console.error("Campaign creation error:", error);
    return NextResponse.json(
      { error: "Failed to create campaigns" },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch existing campaigns for a world
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { worldId } = await params;

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

    // Fetch campaigns for this world
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("world_id", worldId)
      .order("created_at", { ascending: false });

    if (campaignsError) {
      return NextResponse.json(
        { error: "Failed to fetch campaigns" },
        { status: 500 }
      );
    }

    // Generate signed URLs for campaign images
    const campaignsWithUrls = await Promise.all(
      (campaigns || []).map(async (campaign) => {
        const path = `${user.id}/${worldId}/campaigns/${campaign.id}/media/image.jpeg`;
        const { data: signedUrlData } = await supabase.storage
          .from("bucket")
          .createSignedUrl(path, 3600);

        return {
          id: campaign.id,
          content: campaign.content,
          imageUrl: signedUrlData?.signedUrl || null,
          createdAt: campaign.created_at,
        };
      })
    );

    return NextResponse.json({ campaigns: campaignsWithUrls });
  } catch (error) {
    console.error("Fetch campaigns error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

