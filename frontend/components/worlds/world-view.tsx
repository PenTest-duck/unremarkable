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
import type { Database } from "@/lib/supabase/database.types";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

type PersonaWithImage = Tables<"personas"> & {
  imageUrl: string | null;
  segments: { name: string } | null;
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
  const [, setSelectedPersona] = useState<PersonaWithImage | null>(null);
  const [campaignPrompt, setCampaignPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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
              Interact with your simulated customers. Hover for details.
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {personas.map((persona) => (
                <div
                  key={persona.id}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border bg-card transition-all hover:ring-2 hover:ring-primary/20"
                  onMouseEnter={() => setSelectedPersona(persona)}
                  // onMouseLeave={() => setSelectedPersona(null)} // Optional: keep selection
                >
                  {persona.imageUrl ? (
                    <Image
                      src={persona.imageUrl}
                      alt={persona.name}
                      fill
                      className="object-cover p-2 transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-muted/50 text-xs text-muted-foreground">
                      No Image
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <p className="font-semibold text-white text-xs">
                      {persona.name}
                    </p>
                    <p className="text-[10px] text-white/80 line-clamp-1">
                      {persona.age} • {persona.segments?.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Pane: Campaign Control Center */}
        <div className="w-[480px] border-l bg-card flex flex-col">
          <div className="flex h-full flex-col">
            <div className="p-6 pb-0">
              <h2 className="text-lg font-semibold tracking-tight">
                Campaign Simulator
              </h2>
              <p className="text-sm text-muted-foreground">
                Draft content and test it against your personas.
              </p>
            </div>

            <Tabs defaultValue="draft" className="flex-1 flex flex-col mt-6">
              <div className="px-6">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="draft">Draft & Generate</TabsTrigger>
                  <TabsTrigger value="evaluate">Evaluate</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-8">
                  <TabsContent value="draft" className="mt-0 space-y-6">
                    {/* Product Selection */}
                    <div className="space-y-3">
                      <Label>Target Product</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {products.slice(0, 3).map((product) => (
                          <div
                            key={product.id}
                            className="group flex flex-col items-center gap-2 cursor-pointer rounded-lg border p-2 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            {product.image_url ? (
                              <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted/50">
                                <Image
                                  src={product.image_url}
                                  alt={product.name}
                                  fill
                                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                                />
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
                        {products.length > 3 && (
                          <div className="flex items-center justify-center rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
                            +{products.length - 3} more
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
                      className="w-full"
                      disabled={isGenerating}
                      onClick={() => setIsGenerating(!isGenerating)}
                    >
                      {isGenerating
                        ? "Generating Prototypes..."
                        : "Generate 4 Options"}
                    </Button>

                    {/* Mock Generated Options */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Prototypes Preview
                      </div>
                      <div className="grid gap-4">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className="flex gap-4 rounded-lg border p-3 bg-muted/20"
                          >
                            <div className="h-16 w-16 shrink-0 rounded-md bg-muted/50" />
                            <div className="space-y-1">
                              <div className="h-3 w-3/4 rounded bg-muted/50" />
                              <div className="h-3 w-1/2 rounded bg-muted/50" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="evaluate" className="mt-0">
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        ⚡
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold">No Simulation Run</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                          Generate campaign options first, then run a simulation
                          to see how your personas react.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          (
                            document.querySelector(
                              '[value="draft"]'
                            ) as HTMLElement
                          )?.click()
                        }
                      >
                        Go to Draft
                      </Button>
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        </div>
      </div>
    </main>
  );
}
