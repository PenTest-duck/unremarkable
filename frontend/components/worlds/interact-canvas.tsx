"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface InteractCanvasProps {
  world: any;
  personas: any[];
}

export function InteractCanvas({ world, personas }: InteractCanvasProps) {
  const [activePersona, setActivePersona] = useState<any>(null);
  const [globalQuery, setGlobalQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Mock chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");

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

  const handlePersonaClick = (persona: any) => {
    setActivePersona(persona);
    setChatOpen(true);
    setMessages([
      {
        role: "assistant",
        content: `Hi there! I'm ${persona.name}. I'm a ${persona.age}-year-old interested in ${persona.segments?.name}. How can I help?`,
      },
    ]);
  };

  const handleGlobalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalQuery.trim()) return;
    // Mock response for now
    alert(`Asked all ${personas.length} personas: "${globalQuery}"`);
    setGlobalQuery("");
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setMessages([...messages, { role: "user", content: chatInput }]);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "That's an interesting perspective! Based on my shopping habits, I'd say...",
        },
      ]);
    }, 1000);
    setChatInput("");
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white selection:bg-white/20">
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

      <div className="fixed top-6 right-6 z-50 flex gap-2">
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
          {personas.map((persona) => (
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
            <Sparkles className="h-5 w-5 text-purple-400" />
            <Input
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder={`Ask ${personas.length} ${
                personas.length === 1 ? "persona" : "personas"
              } a question...`}
              className="h-10 border-0 bg-transparent px-2 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              size="icon"
              type="submit"
              className="h-9 w-9 rounded-xl bg-white text-black hover:bg-white/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>

      {/* Interaction Dialog (Chat) */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="sm:max-w-[400px] border-white/10 bg-black/90 p-0 text-white shadow-2xl backdrop-blur-xl gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-white/10">
                <AvatarImage
                  src={activePersona?.imageUrl}
                  className="object-cover"
                />
                <AvatarFallback className="bg-white/10 text-white">
                  {activePersona?.name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <DialogTitle className="text-sm font-semibold">
                  {activePersona?.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-white/50">
                  {activePersona?.age} • {activePersona?.segments?.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex h-[400px] flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex w-full",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.role === "user"
                        ? "bg-white text-black rounded-tr-sm"
                        : "bg-white/10 text-white rounded-tl-sm"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5">
              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="bg-black/50 border-white/10 text-white focus-visible:ring-white/20"
                />
                <Button
                  size="icon"
                  type="submit"
                  variant="secondary"
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
