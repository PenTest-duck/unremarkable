"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Sparkles,
  Loader2,
  X,
  Users,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PersonaChat } from "@/components/worlds/persona-chat";
import { VisitorOnboarding } from "@/components/worlds/visitor-onboarding";

interface WorldAskResponse {
  answer: string;
  sourcedFrom: {
    personaId: string;
    personaName: string;
    response: string;
  }[];
  totalPersonasConsidered: number;
}

interface VisitorPersona {
  name: string;
  age: number;
  story: string;
  traits: string[];
  imageBase64: string | null;
}

interface Persona {
  id: string;
  name: string;
  age: number;
  story: string;
  segment_id: string;
  imageUrl: string | null;
  segments: { name: string } | null;
  x: number;
  y: number;
}

interface World {
  id: string;
  name: string;
  description: string | null;
  store_url: string;
  backdropUrl: string | null;
}

interface InteractCanvasProps {
  world: World;
  personas: Persona[];
}

// Generate safe positions that avoid UI elements with better distribution
// Exclusion zones: top 12% (header), bottom 25% (input bar + buffer)
function generateSafePosition(
  id: string,
  index: number
): { x: number; y: number } {
  // Create a more sophisticated hash from the ID
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use golden ratio for better distribution
  const goldenRatio = 0.618033988749895;
  const angle = (index * goldenRatio) % 1;

  // Combine hash and angle for more spread out positions
  const hashX = Math.abs(hash % 100) / 100;
  const hashY = Math.abs((hash * 7) % 100) / 100;

  // Use spiral-like distribution combined with hash for natural spread
  const spiralX = Math.cos(angle * Math.PI * 2) * 0.35 + 0.5;
  const spiralY = Math.sin(angle * Math.PI * 2) * 0.35 + 0.5;

  // Blend hash and spiral for natural spread
  const x = (hashX * 0.3 + spiralX * 0.7) * 0.77 + 0.08; // 8% to 85%
  const y = (hashY * 0.3 + spiralY * 0.7) * 0.5 + 0.15; // 15% to 65%

  return {
    x: x * 100,
    y: y * 100,
  };
}

export function InteractCanvas({ world, personas }: InteractCanvasProps) {
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [globalQuery, setGlobalQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [visitorPersona, setVisitorPersona] = useState<VisitorPersona | null>(
    null
  );

  // Drag constraints and canvas size
  const [dragConstraints, setDragConstraints] = useState({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  });
  const [canvasSize, setCanvasSize] = useState({
    width: "100vw",
    height: "100vh",
  });

  // Chat dialog state
  const [chatOpen, setChatOpen] = useState(false);

  // World ask state
  const [isAskingWorld, setIsAskingWorld] = useState(false);
  const [worldResponse, setWorldResponse] = useState<WorldAskResponse | null>(
    null
  );
  const [askedQuestion, setAskedQuestion] = useState("");
  const [showWorldResponse, setShowWorldResponse] = useState(false);

  // Recalculate safe positions for personas with better distribution
  const safePersonas = useMemo(() => {
    return personas.map((p, index) => ({
      ...p,
      ...generateSafePosition(p.id, index),
    }));
  }, [personas]);

  // Handle onboarding completion
  const handleOnboardingComplete = (persona: VisitorPersona) => {
    setVisitorPersona(persona);
    setShowOnboarding(false);
  };

  // Load image dimensions and set up resize listener
  useEffect(() => {
    if (!world.backdropUrl) return;

    let resizeHandler: (() => void) | null = null;

    const calculateAndSetConstraints = (
      imgWidth: number,
      imgHeight: number
    ) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate how large the image should be displayed
      // We want the image to at least fill the viewport, but maintain aspect ratio
      const imageAspect = imgWidth / imgHeight;
      const viewportAspect = viewportWidth / viewportHeight;

      let displayWidth: number;
      let displayHeight: number;

      if (imageAspect > viewportAspect) {
        // Image is wider than viewport - height fills, width extends
        displayHeight = viewportHeight;
        displayWidth = viewportHeight * imageAspect;
      } else {
        // Image is taller than viewport - width fills, height extends
        displayWidth = viewportWidth;
        displayHeight = viewportWidth / imageAspect;
      }

      // Ensure minimum size is viewport size (for small images)
      displayWidth = Math.max(displayWidth, viewportWidth);
      displayHeight = Math.max(displayHeight, viewportHeight);

      setCanvasSize({
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
      });

      // Calculate how much we can drag in each direction
      const maxDragLeft = -(displayWidth - viewportWidth);
      const maxDragTop = -(displayHeight - viewportHeight);

      setDragConstraints({
        left: maxDragLeft,
        right: 0,
        top: maxDragTop,
        bottom: 0,
      });
    };

    const img = new window.Image();
    img.onload = () => {
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      calculateAndSetConstraints(imgWidth, imgHeight);

      // Set up resize handler with the loaded dimensions
      resizeHandler = () => calculateAndSetConstraints(imgWidth, imgHeight);
      window.addEventListener("resize", resizeHandler);
    };
    img.src = world.backdropUrl;

    return () => {
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
    };
  }, [world.backdropUrl]);

  const handlePersonaClick = (persona: Persona) => {
    setActivePersona(persona);
    setChatOpen(true);
  };

  const handleGlobalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalQuery.trim() || isAskingWorld) return;

    const question = globalQuery.trim();
    setAskedQuestion(question);
    setGlobalQuery("");
    setIsAskingWorld(true);
    setWorldResponse(null);
    setShowWorldResponse(true);

    try {
      const response = await fetch(`/api/worlds/${world.id}/personas/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data: WorldAskResponse = await response.json();
      setWorldResponse(data);
    } catch (error) {
      console.error("Error asking world:", error);
      setWorldResponse({
        answer: "Sorry, I couldn't get a response right now. Please try again.",
        sourcedFrom: [],
        totalPersonasConsidered: safePersonas.length,
      });
    } finally {
      setIsAskingWorld(false);
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white selection:bg-white/20">
      {/* Visitor Onboarding Overlay */}
      {showOnboarding && (
        <VisitorOnboarding
          worldId={world.id}
          worldName={world.name}
          backdropUrl={world.backdropUrl}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Navigation & Controls Overlay */}
      <div className="fixed top-6 left-6 z-50">
        <Link href={`/worlds/${world.id}`}>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full border-white/20 bg-black/40 text-white backdrop-blur-md hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      <div className="fixed top-6 right-6 z-50 flex items-center gap-3">
        {/* Visitor persona indicator */}
        {visitorPersona && (
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur-md">
            {visitorPersona.imageBase64 && (
              <div className="h-6 w-6 overflow-hidden rounded-full">
                <Image
                  src={visitorPersona.imageBase64}
                  alt={visitorPersona.name}
                  width={24}
                  height={24}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <span className="text-xs font-medium text-white/70">
              {visitorPersona.name}
            </span>
          </div>
        )}
        <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
          {world.name}
        </div>
      </div>

      {/* Draggable World Canvas */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden cursor-grab active:cursor-grabbing"
      >
        <motion.div
          drag
          dragConstraints={dragConstraints}
          dragElastic={0}
          dragMomentum={false}
          className="relative"
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            backgroundImage: world.backdropUrl
              ? `url(${world.backdropUrl})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "top left",
          }}
        >
          {/* Overlay gradient for better text visibility */}
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />

          {/* Personas */}
          {safePersonas.map((persona) => (
            <motion.div
              key={persona.id}
              className="absolute cursor-pointer group"
              style={{
                left: `${persona.x}%`,
                top: `${persona.y}%`,
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePersonaClick(persona)}
            >
              {/* Persona Avatar */}
              <div className="relative">
                <div className="h-24 w-24 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                  {persona.imageUrl ? (
                    <Image
                      src={persona.imageUrl}
                      alt={persona.name}
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-xs backdrop-blur-sm">
                      ?
                    </div>
                  )}
                </div>

                {/* Speech Bubble / Name Tag on Hover */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                  <div className="whitespace-nowrap rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-black shadow-lg">
                    {persona.name}
                  </div>
                  <div className="mx-auto mt-[-1px] h-0 w-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-white/90" />
                </div>

                {/* Status Indicator */}
                <div className="absolute bottom-0 right-2 h-3 w-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Global Input (Bottom Center) */}
      <div className="fixed bottom-8 left-1/2 z-40 w-full max-w-xl -translate-x-1/2 px-6">
        <form onSubmit={handleGlobalSubmit} className="relative group">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
          <div className="relative flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-2 pl-4 shadow-2xl backdrop-blur-xl transition-all focus-within:border-white/20 focus-within:bg-black/80">
            {isAskingWorld ? (
              <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5 text-purple-400" />
            )}
            <Input
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder={
                isAskingWorld
                  ? "Thinking..."
                  : `Ask ${safePersonas.length} ${
                      safePersonas.length === 1 ? "persona" : "personas"
                    } a question...`
              }
              disabled={isAskingWorld}
              className="h-10 border-0 bg-transparent px-2 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50"
            />
            <Button
              size="icon"
              type="submit"
              disabled={isAskingWorld || !globalQuery.trim()}
              className="h-9 w-9 rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>

      {/* Interaction Dialog (Chat) */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="sm:max-w-[450px] border-white/10 bg-black/95 p-0 text-white shadow-2xl backdrop-blur-xl gap-0 overflow-hidden max-h-[85vh]">
          <DialogHeader className="px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-white/10">
                  <AvatarImage
                    src={activePersona?.imageUrl || undefined}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-white/10 text-white">
                    {activePersona?.name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <DialogTitle className="text-sm font-semibold text-white">
                    {activePersona?.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-white/50">
                    {activePersona?.age} • {activePersona?.segments?.name}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {activePersona && (
            <div className="h-[500px]">
              <PersonaChat
                key={activePersona.id}
                worldId={world.id}
                persona={activePersona}
                chatContext="interact"
                className="h-full [&_input]:bg-black/50 [&_input]:border-white/10 [&_input]:text-white [&_input]:placeholder:text-white/40 [&_input:focus-visible]:ring-white/20 [&_.bg-muted]:bg-white/10 [&_.bg-muted]:text-white [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-white/60 [&_.bg-primary]:bg-white [&_.bg-primary]:text-black [&_.text-primary]:text-white [&_.bg-primary\/10]:bg-white/10 [&_.bg-primary\/20]:bg-white/20 [&_.border-t]:border-white/10 [&_.bg-background\/50]:bg-black/30"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* World Response Panel */}
      <AnimatePresence>
        {showWorldResponse && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-28 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-6"
          >
            <div className="relative rounded-2xl border border-white/10 bg-black/80 p-5 shadow-2xl backdrop-blur-xl">
              {/* Close button */}
              <button
                onClick={() => setShowWorldResponse(false)}
                className="absolute right-3 top-3 rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Question */}
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
                  <MessageCircle className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white/50 mb-1">
                    You asked
                  </p>
                  <p className="text-sm text-white/90">{askedQuestion}</p>
                </div>
              </div>

              {/* Loading state */}
              {isAskingWorld && (
                <div className="flex items-center gap-3 py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                  <p className="text-sm text-white/60">
                    Consulting with the community...
                  </p>
                </div>
              )}

              {/* Response */}
              {worldResponse && !isAskingWorld && (
                <div className="space-y-4">
                  {/* Main answer */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/50 mb-1">
                        Community response
                        {worldResponse.sourcedFrom.length > 0 && (
                          <span className="ml-1 text-purple-400">
                            · {worldResponse.sourcedFrom.length}{" "}
                            {worldResponse.sourcedFrom.length === 1
                              ? "voice"
                              : "voices"}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-white/90 leading-relaxed">
                        {worldResponse.answer}
                      </p>
                    </div>
                  </div>

                  {/* Source personas (collapsible) */}
                  {worldResponse.sourcedFrom.length > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-white/40 hover:text-white/60 transition-colors list-none flex items-center gap-1.5">
                        <span className="group-open:rotate-90 transition-transform">
                          ▶
                        </span>
                        See individual perspectives
                      </summary>
                      <div className="mt-3 space-y-2 pl-2 border-l border-white/10">
                        {worldResponse.sourcedFrom.map((source) => {
                          const persona = safePersonas.find(
                            (p) => p.id === source.personaId
                          );
                          return (
                            <div
                              key={source.personaId}
                              className="flex items-start gap-2 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                              onClick={() => {
                                if (persona) {
                                  handlePersonaClick(persona);
                                  setShowWorldResponse(false);
                                }
                              }}
                            >
                              <Avatar className="h-6 w-6 border border-white/10 shrink-0">
                                <AvatarImage
                                  src={persona?.imageUrl || undefined}
                                  className="object-cover"
                                />
                                <AvatarFallback className="bg-white/10 text-white text-[10px]">
                                  {source.personaName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-white/70">
                                  {source.personaName}
                                </p>
                                <p className="text-xs text-white/50 line-clamp-2">
                                  {source.response}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
