"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MessageCircle,
  Users,
  Loader2,
  Star,
  Sparkles,
  Play,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { PersonaChat } from "@/components/worlds/persona-chat";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

type PersonaWithImage = Tables<"personas"> & {
  imageUrl: string | null;
  segments: { name: string } | null;
};

type Campaign = {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
};

type FeedbackItem = {
  personaId: string;
  personaName: string;
  rating: number;
  feedback: string;
};

type SimulationResult = {
  campaignId: string;
  averageRating: number;
  feedbacks: FeedbackItem[];
};

interface WorldViewProps {
  world: Tables<"worlds">;
  segments: Tables<"segments">[];
  personas: PersonaWithImage[];
  products: Tables<"products">[];
}

export function WorldView({
  world,
  segments,
  personas,
  products,
}: WorldViewProps) {
  const [selectedPersona, setSelectedPersona] =
    useState<PersonaWithImage | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [campaignPrompt, setCampaignPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    products.length > 0 ? products[0].id : null
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState<
    SimulationResult[]
  >([]);
  const [activeTab, setActiveTab] = useState("draft");
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(
    null
  );
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(
    new Set()
  );

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const toggleSegment = (segmentId: string) => {
    setExpandedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) {
        next.delete(segmentId);
      } else {
        next.add(segmentId);
      }
      return next;
    });
  };

  const handlePersonaChat = (persona: PersonaWithImage) => {
    setSelectedPersona(persona);
    setChatOpen(true);
  };

  const handleGenerateCampaigns = async () => {
    if (!selectedProductId || !campaignPrompt.trim()) return;

    setIsGenerating(true);
    setCampaigns([]);
    setSimulationResults([]);

    try {
      const response = await fetch(`/api/worlds/${world.id}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          prompt: campaignPrompt,
          count: 4,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate campaigns");
      }

      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error("Campaign generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunSimulation = async () => {
    if (campaigns.length === 0) return;

    setIsSimulating(true);
    setSimulationResults([]);

    try {
      const response = await fetch(`/api/worlds/${world.id}/simulations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignIds: campaigns.map((c) => c.id),
          prompt: campaignPrompt,
          productName: selectedProduct?.name || "the product",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to run simulation");
      }

      const data = await response.json();
      setSimulationResults(data.results || []);
      setActiveTab("evaluate");
    } catch (error) {
      console.error("Simulation error:", error);
    } finally {
      setIsSimulating(false);
    }
  };

  const getResultForCampaign = (campaignId: string) => {
    return simulationResults.find((r) => r.campaignId === campaignId);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-emerald-500";
    if (rating >= 3) return "text-amber-500";
    return "text-rose-500";
  };

  const getRatingBg = (rating: number) => {
    if (rating >= 4) return "bg-emerald-500/10";
    if (rating >= 3) return "bg-amber-500/10";
    return "bg-rose-500/10";
  };

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/worlds"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-semibold">{world.name}</h1>
          <Badge variant="outline" className="text-xs font-normal">
            {personas.length} Personas
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/worlds/${world.id}/interact`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Users className="h-4 w-4" />
              Customer View
            </Button>
          </Link>
          <Button variant="ghost" size="sm">
            Settings
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: World Visualization (Personas Grid) */}
        <div className="flex-1 overflow-y-auto bg-secondary/10 p-6">
          <div className="mb-6 space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Population</h2>
            <p className="text-sm text-muted-foreground">
              Click on a persona to chat and understand their buyer behavior.
            </p>
          </div>

          {segments.length === 0 && personas.length === 0 ? (
            <div className="flex h-[400px] flex-col items-center justify-center rounded-xl border border-dashed text-center">
              <p className="text-muted-foreground">No population yet.</p>
              <Button variant="link" className="mt-2">
                Generate Segments & Personas
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {segments.map((segment) => {
                const segmentPersonas = personas.filter(
                  (p) => p.segment_id === segment.id
                );

                if (segmentPersonas.length === 0) return null;

                const isExpanded = expandedSegments.has(segment.id);

                return (
                  <div key={segment.id} className="space-y-4">
                    {/* Segment Header */}
                    <div className="space-y-3">
                      <button
                        onClick={() => toggleSegment(segment.id)}
                        className="flex w-full items-center justify-between border-b border-border/50 pb-3 hover:border-border transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px] shadow-primary/50" />
                          <div className="text-left">
                            <h3 className="text-base font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
                              {segment.name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {segmentPersonas.length}{" "}
                              {segmentPersonas.length === 1
                                ? "persona"
                                : "personas"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="text-xs font-normal bg-primary/10 text-primary border-primary/20"
                          >
                            {segmentPersonas.length}
                          </Badge>
                          <div className="h-8 w-8 rounded-md flex items-center justify-center bg-muted/50 group-hover:bg-muted transition-colors">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Segment Details */}
                      {isExpanded && (
                        <div className="rounded-lg border bg-card/50 p-4 space-y-4 transition-all duration-200">
                          <div className="flex items-center gap-2 mb-3">
                            <Info className="h-4 w-4 text-primary" />
                            <h4 className="text-sm font-semibold text-foreground">
                              Segment Details
                            </h4>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-3">
                            {/* Demographic */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="h-1 w-1 rounded-full bg-blue-500" />
                                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                  Demographic
                                </label>
                              </div>
                              <p className="text-sm text-foreground leading-relaxed pl-3">
                                {segment.demographic || "Not specified"}
                              </p>
                            </div>

                            {/* Geographic */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="h-1 w-1 rounded-full bg-emerald-500" />
                                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                  Geographic
                                </label>
                              </div>
                              <p className="text-sm text-foreground leading-relaxed pl-3">
                                {segment.geographic || "Not specified"}
                              </p>
                            </div>

                            {/* Psychographic */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="h-1 w-1 rounded-full bg-purple-500" />
                                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                  Psychographic
                                </label>
                              </div>
                              <p className="text-sm text-foreground leading-relaxed pl-3">
                                {segment.psycographic || "Not specified"}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Personas Grid */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {segmentPersonas.map((persona) => (
                        <div
                          key={persona.id}
                          className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border bg-card transition-all hover:ring-2 hover:ring-primary/20 hover:shadow-lg"
                          onClick={() => handlePersonaChat(persona)}
                        >
                          {persona.imageUrl ? (
                            <Image
                              src={persona.imageUrl}
                              alt={persona.name}
                              fill
                              className="object-cover p-2 transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted/50 to-muted/30 text-xs text-muted-foreground">
                              <div className="text-center space-y-1">
                                <div className="text-lg">👤</div>
                                <div className="text-[10px]">No Image</div>
                              </div>
                            </div>
                          )}

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white text-xs truncate">
                                  {persona.name}
                                </p>
                                <p className="text-[10px] text-white/80 line-clamp-1 mt-0.5">
                                  {persona.age} years old
                                </p>
                              </div>
                              <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0 ml-2">
                                <MessageCircle className="h-3.5 w-3.5 text-white" />
                              </div>
                            </div>
                          </div>

                          {/* Segment Badge (always visible) */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10">
                              <p className="text-[9px] font-medium text-white/90">
                                {segment.name}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Unassigned Personas (if any) */}
              {personas.some((p) => !p.segment_id) && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border/50 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                      <div>
                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                          Unassigned
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {personas.filter((p) => !p.segment_id).length}{" "}
                          {personas.filter((p) => !p.segment_id).length === 1
                            ? "persona"
                            : "personas"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs font-normal">
                      {personas.filter((p) => !p.segment_id).length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {personas
                      .filter((p) => !p.segment_id)
                      .map((persona) => (
                        <div
                          key={persona.id}
                          className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border bg-card transition-all hover:ring-2 hover:ring-primary/20 hover:shadow-lg"
                          onClick={() => handlePersonaChat(persona)}
                        >
                          {persona.imageUrl ? (
                            <Image
                              src={persona.imageUrl}
                              alt={persona.name}
                              fill
                              className="object-cover p-2 transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted/50 to-muted/30 text-xs text-muted-foreground">
                              <div className="text-center space-y-1">
                                <div className="text-lg">👤</div>
                                <div className="text-[10px]">No Image</div>
                              </div>
                            </div>
                          )}

                          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white text-xs truncate">
                                  {persona.name}
                                </p>
                                <p className="text-[10px] text-white/80 line-clamp-1 mt-0.5">
                                  {persona.age} years old
                                </p>
                              </div>
                              <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0 ml-2">
                                <MessageCircle className="h-3.5 w-3.5 text-white" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Pane: Campaign Control Center */}
        <div className="w-[480px] border-l bg-card flex flex-col overflow-hidden">
          <div className="flex h-full flex-col overflow-hidden">
            <div className="p-6 pb-0 shrink-0">
              <h2 className="text-lg font-semibold tracking-tight">
                Campaign Simulator
              </h2>
              <p className="text-sm text-muted-foreground">
                Draft content and test it against your personas.
              </p>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col mt-6 min-h-0 overflow-hidden"
            >
              <div className="px-6 shrink-0">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="draft">Draft & Generate</TabsTrigger>
                  <TabsTrigger value="evaluate" className="relative">
                    Evaluate
                    {simulationResults.length > 0 && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-6 space-y-8">
                  <TabsContent value="draft" className="mt-0 space-y-6">
                    {/* Product Selection */}
                    <div className="space-y-3">
                      <Label>Target Product</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {products.slice(0, 6).map((product) => (
                          <div
                            key={product.id}
                            onClick={() => setSelectedProductId(product.id)}
                            className={cn(
                              "group flex flex-col items-center gap-2 cursor-pointer rounded-lg border p-2 text-xs transition-all",
                              selectedProductId === product.id
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            {product.image_url ? (
                              <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted/50">
                                <Image
                                  src={product.image_url}
                                  alt={product.name}
                                  fill
                                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                                {selectedProductId === product.id && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                                    <Check className="h-5 w-5 text-primary" />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                                <span className="text-[10px]">No Img</span>
                              </div>
                            )}
                            <span className="w-full truncate text-center font-medium">
                              {product.name}
                            </span>
                          </div>
                        ))}
                        {products.length > 6 && (
                          <div className="flex items-center justify-center rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
                            +{products.length - 6} more
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Campaign Prompt */}
                    <div className="space-y-3">
                      <Label>Campaign Directive</Label>
                      <Textarea
                        placeholder="e.g. Create a moody, mysterious instagram post for the winter collection emphasizing exclusivity..."
                        className="min-h-[120px] resize-none"
                        value={campaignPrompt}
                        onChange={(e) => setCampaignPrompt(e.target.value)}
                      />
                    </div>

                    <Button
                      className="w-full gap-2"
                      disabled={
                        isGenerating ||
                        !selectedProductId ||
                        !campaignPrompt.trim()
                      }
                      onClick={handleGenerateCampaigns}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating Prototypes...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate 4 Options
                        </>
                      )}
                    </Button>

                    {/* Generated Campaigns */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {campaigns.length > 0
                            ? "Generated Campaigns"
                            : "Prototypes Preview"}
                        </div>
                        {campaigns.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-7 text-xs"
                            onClick={handleRunSimulation}
                            disabled={isSimulating}
                          >
                            {isSimulating ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Simulating...
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3" />
                                Run Simulation
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-4">
                        {campaigns.length > 0
                          ? campaigns.map((campaign, index) => {
                              const result = getResultForCampaign(campaign.id);
                              return (
                                <div
                                  key={campaign.id}
                                  className="group rounded-lg border p-3 bg-muted/20 hover:bg-muted/30 transition-colors"
                                >
                                  <div className="flex gap-4">
                                    <div className="relative h-20 w-20 shrink-0 rounded-md overflow-hidden bg-muted/50">
                                      {campaign.imageUrl ? (
                                        <Image
                                          src={campaign.imageUrl}
                                          alt={`Campaign ${index + 1}`}
                                          fill
                                          className="object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-full items-center justify-center">
                                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-xs text-foreground line-clamp-3 leading-relaxed">
                                          {campaign.content}
                                        </p>
                                        {result && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <div
                                                  className={cn(
                                                    "flex items-center gap-1 px-2 py-1 rounded-full shrink-0",
                                                    getRatingBg(
                                                      result.averageRating
                                                    )
                                                  )}
                                                >
                                                  <Star
                                                    className={cn(
                                                      "h-3 w-3",
                                                      getRatingColor(
                                                        result.averageRating
                                                      )
                                                    )}
                                                  />
                                                  <span
                                                    className={cn(
                                                      "text-xs font-semibold",
                                                      getRatingColor(
                                                        result.averageRating
                                                      )
                                                    )}
                                                  >
                                                    {result.averageRating}
                                                  </span>
                                                </div>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>
                                                  Average rating from{" "}
                                                  {result.feedbacks.length}{" "}
                                                  personas
                                                </p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          : // Placeholder skeleton
                            [1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className="flex gap-4 rounded-lg border p-3 bg-muted/20"
                              >
                                <div className="h-16 w-16 shrink-0 rounded-md bg-muted/50" />
                                <div className="flex-1 space-y-2 py-1">
                                  <div className="h-3 w-3/4 rounded bg-muted/50" />
                                  <div className="h-3 w-1/2 rounded bg-muted/50" />
                                </div>
                              </div>
                            ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="evaluate" className="mt-0">
                    {simulationResults.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          ⚡
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-semibold">No Simulation Run</h3>
                          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            Generate campaign options first, then run a
                            simulation to see how your personas react.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("draft")}
                        >
                          Go to Draft
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Summary */}
                        <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
                          <h3 className="font-semibold text-sm">
                            Simulation Complete
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {personas.length} personas evaluated{" "}
                            {campaigns.length} campaigns
                          </p>
                          <div className="flex gap-2 mt-3">
                            {simulationResults
                              .sort((a, b) => b.averageRating - a.averageRating)
                              .map((result, i) => {
                                const campaignIndex = campaigns.findIndex(
                                  (c) => c.id === result.campaignId
                                );
                                return (
                                  <div
                                    key={result.campaignId}
                                    className={cn(
                                      "flex-1 p-2 rounded-lg text-center",
                                      i === 0
                                        ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                                        : "bg-muted/50"
                                    )}
                                  >
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                      #{campaignIndex + 1}
                                    </div>
                                    <div
                                      className={cn(
                                        "text-lg font-bold",
                                        getRatingColor(result.averageRating)
                                      )}
                                    >
                                      {result.averageRating}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>

                        {/* Detailed Results by Campaign */}
                        <div className="space-y-4">
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Detailed Feedback
                          </div>

                          {campaigns.map((campaign, index) => {
                            const result = getResultForCampaign(campaign.id);
                            if (!result) return null;

                            const isExpanded =
                              expandedCampaignId === campaign.id;

                            return (
                              <div
                                key={campaign.id}
                                className="rounded-lg border overflow-hidden"
                              >
                                <button
                                  onClick={() =>
                                    setExpandedCampaignId(
                                      isExpanded ? null : campaign.id
                                    )
                                  }
                                  className="w-full p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
                                >
                                  <div className="relative h-12 w-12 shrink-0 rounded-md overflow-hidden bg-muted/50">
                                    {campaign.imageUrl && (
                                      <Image
                                        src={campaign.imageUrl}
                                        alt={`Campaign ${index + 1}`}
                                        fill
                                        className="object-cover"
                                      />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold">
                                        Campaign {index + 1}
                                      </span>
                                      <div
                                        className={cn(
                                          "flex items-center gap-1 px-1.5 py-0.5 rounded-full",
                                          getRatingBg(result.averageRating)
                                        )}
                                      >
                                        <Star
                                          className={cn(
                                            "h-2.5 w-2.5",
                                            getRatingColor(result.averageRating)
                                          )}
                                        />
                                        <span
                                          className={cn(
                                            "text-[10px] font-semibold",
                                            getRatingColor(result.averageRating)
                                          )}
                                        >
                                          {result.averageRating}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                                      {campaign.content}
                                    </p>
                                  </div>
                                  <span className="text-muted-foreground text-xs">
                                    {isExpanded ? "▲" : "▼"}
                                  </span>
                                </button>

                                {isExpanded && (
                                  <div className="border-t bg-muted/10 p-3 space-y-3">
                                    {result.feedbacks.map((fb) => {
                                      const persona = personas.find(
                                        (p) => p.id === fb.personaId
                                      );
                                      return (
                                        <div
                                          key={fb.personaId}
                                          className="flex gap-3"
                                        >
                                          <Avatar className="h-8 w-8 shrink-0">
                                            <AvatarImage
                                              src={
                                                persona?.imageUrl || undefined
                                              }
                                              className="object-cover"
                                            />
                                            <AvatarFallback className="text-[10px]">
                                              {fb.personaName[0]}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-medium">
                                                {fb.personaName}
                                              </span>
                                              <div className="flex items-center gap-0.5">
                                                {[...Array(5)].map((_, i) => (
                                                  <Star
                                                    key={i}
                                                    className={cn(
                                                      "h-2.5 w-2.5",
                                                      i < fb.rating
                                                        ? "fill-amber-400 text-amber-400"
                                                        : "text-muted-foreground/30"
                                                    )}
                                                  />
                                                ))}
                                              </div>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                              {fb.feedback}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Persona Chat Dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden max-h-[85vh]">
          <DialogHeader className="px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border">
                <AvatarImage
                  src={selectedPersona?.imageUrl || undefined}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedPersona?.name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-left flex-1">
                <DialogTitle className="text-sm font-semibold">
                  {selectedPersona?.name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedPersona?.age} • {selectedPersona?.segments?.name} •
                  Buyer Interview
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedPersona && (
            <div className="h-[500px]">
              <PersonaChat
                key={selectedPersona.id}
                worldId={world.id}
                persona={selectedPersona}
                chatContext="business"
                className="h-full"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
