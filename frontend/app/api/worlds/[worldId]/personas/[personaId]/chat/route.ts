import { convertToModelMessages, streamText, UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-2.5-flash-lite-preview-09-2025"),
    system: "You are a helpful assistant.",
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
