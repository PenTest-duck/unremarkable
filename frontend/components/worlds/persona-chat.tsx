"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Persona {
  id: string;
  name: string;
  age: number;
  story: string;
  imageUrl?: string | null;
  segments?: { name: string } | null;
}

interface PersonaChatProps {
  worldId: string;
  persona: Persona;
  chatContext: "interact" | "business";
  className?: string;
}

export function PersonaChat({
  worldId,
  persona,
  chatContext,
  className,
}: PersonaChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  // Initial welcome message
  const welcomeMessage =
    chatContext === "interact"
      ? `Hey! I'm ${persona.name}, nice to meet you! I've been shopping here for a while. What's on your mind?`
      : `Hello, I'm ${persona.name}. I'm happy to share my thoughts and experiences as a customer. What would you like to know?`;

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/worlds/${worldId}/personas/${persona.id}/chat`,
      body: {
        chatContext,
      },
    }),
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === "ready") {
      sendMessage({ text: input });
      setInput("");
    }
  };

  // Helper to render message content from parts
  const renderMessageContent = (message: (typeof messages)[0]) => {
    if (message.parts && message.parts.length > 0) {
      return message.parts.map((part, index) =>
        part.type === "text" ? <span key={index}>{part.text}</span> : null
      );
    }
    return null;
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome message (not from AI, just UI) */}
        {messages.length === 0 && (
          <div className="flex w-full gap-3 justify-start">
            <Avatar className="h-8 w-8 shrink-0 border border-border/50">
              <AvatarImage
                src={persona.imageUrl || undefined}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {persona.name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-muted text-foreground rounded-tl-sm">
              {welcomeMessage}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex w-full gap-3",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <Avatar className="h-8 w-8 shrink-0 border border-border/50">
                <AvatarImage
                  src={persona.imageUrl || undefined}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {persona.name[0]}
                </AvatarFallback>
              </Avatar>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                message.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-muted text-foreground rounded-tl-sm"
              )}
            >
              {renderMessageContent(message)}
            </div>
            {message.role === "user" && (
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                You
              </div>
            )}
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0 border border-border/50">
              <AvatarImage
                src={persona.imageUrl || undefined}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {persona.name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 rounded-tl-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Typing...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-sm text-destructive">
              Something went wrong. Please try again.
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4 bg-background/50">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              chatContext === "interact"
                ? "Ask about products, experiences..."
                : "Ask about their buying behavior..."
            }
            disabled={status !== "ready"}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={status !== "ready" || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
