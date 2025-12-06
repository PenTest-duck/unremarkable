"use client";

import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import type {
  ProgressResponse,
  ProgressStep,
} from "@/app/api/worlds/[worldId]/progress/route";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  store_url: z.string().url("Enter a valid URL"),
  notes: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

// ─────────────────────────────────────────────────────────────────────────────
// Progress Step Component
// ─────────────────────────────────────────────────────────────────────────────

function ProgressStepItem({
  step,
  index,
}: {
  step: ProgressStep;
  index: number;
}) {
  const isActive = step.status === "in_progress";
  const isComplete = step.status === "complete";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="flex items-center gap-4"
    >
      {/* Status indicator */}
      <div className="relative flex items-center justify-center">
        <div
          className={`
            h-8 w-8 rounded-full flex items-center justify-center
            transition-all duration-500 ease-out
            ${
              isComplete
                ? "bg-emerald-500 text-white"
                : isActive
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground"
            }
          `}
        >
          {isComplete ? (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </motion.svg>
          ) : isActive ? (
            <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
          ) : (
            <span className="text-xs font-semibold">{index + 1}</span>
          )}
        </div>
        {/* Pulse ring for active step */}
        {isActive && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut",
            }}
            className="absolute inset-0 rounded-full bg-primary/30"
          />
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 min-w-0">
        <div
          className={`
            font-medium text-sm transition-colors duration-300
            ${
              isComplete
                ? "text-emerald-600"
                : isActive
                ? "text-foreground"
                : "text-muted-foreground"
            }
          `}
        >
          {step.label}
        </div>

        {/* Progress counter for steps with totals */}
        {step.total !== undefined && step.current !== undefined && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-1"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(
                      (step.current / step.total) * 100,
                      100
                    )}%`,
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    isComplete ? "bg-emerald-500" : "bg-primary"
                  }`}
                />
              </div>
              <span
                className={`text-xs font-mono tabular-nums ${
                  isComplete ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                {step.current}/{step.total}
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress Panel
// ─────────────────────────────────────────────────────────────────────────────

function ProgressPanel({
  worldId,
  worldName,
  onComplete,
}: {
  worldId: string;
  worldName: string;
  onComplete: () => void;
}) {
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/worlds/${worldId}/progress`);
      if (!response.ok) {
        throw new Error("Failed to fetch progress");
      }
      const data: ProgressResponse = await response.json();
      setProgress(data);

      if (data.isComplete) {
        // Small delay before navigating to let the user see completion
        setTimeout(onComplete, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [worldId, onComplete]);

  useEffect(() => {
    fetchProgress();
    const interval = setInterval(fetchProgress, 1500); // Poll every 1.5s
    return () => clearInterval(interval);
  }, [fetchProgress]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative space-y-6 rounded-xl border border-border bg-white p-6 shadow-sm"
    >
      {/* Header */}
      <div className="text-center space-y-1">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-semibold text-foreground"
        >
          Building{" "}
          <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            {worldName}
          </span>
        </motion.div>
        <p className="text-xs text-muted-foreground">
          Generating your simulated customer world...
        </p>
      </div>

      {/* Steps */}
      {progress ? (
        <div className="space-y-4">
          {progress.steps.map((step, index) => (
            <ProgressStepItem key={step.id} step={step} index={index} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center text-destructive text-sm">{error}</div>
      ) : (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* Completion animation */}
      <AnimatePresence>
        {progress?.isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center pt-2"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              World ready! Redirecting...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative elements */}
      <div className="absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Form Component
// ─────────────────────────────────────────────────────────────────────────────

export function CreateWorldForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdWorld, setCreatedWorld] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      store_url: "",
      notes: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/worlds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const payload = await response.json();

      if (!response.ok) {
        setServerError(payload.error || "Failed to create world");
        setIsSubmitting(false);
        return;
      }

      // Set created world to trigger progress panel
      setCreatedWorld({
        id: payload.world.id,
        name: payload.world.name,
      });
    } catch {
      setServerError("Network error. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleComplete = useCallback(() => {
    if (createdWorld) {
      router.push(`/worlds/${createdWorld.id}`);
      router.refresh();
    }
  }, [createdWorld, router]);

  // Show progress panel if world is being created
  if (createdWorld) {
    return (
      <ProgressPanel
        worldId={createdWorld.id}
        worldName={createdWorld.name}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="relative space-y-5 rounded-xl border border-border bg-white p-6 shadow-sm"
      >
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  World Name
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Ski Haven"
                    {...field}
                    disabled={isSubmitting}
                    className="h-10 bg-transparent text-base"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="store_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Store URL
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://store.example.com"
                    {...field}
                    disabled={isSubmitting}
                    className="h-10 bg-transparent font-mono text-sm text-muted-foreground focus:text-foreground transition-colors"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Notes (Optional)
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the vibe..."
                    {...field}
                    disabled={isSubmitting}
                    className="min-h-[80px] bg-transparent resize-none text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <AnimatePresence mode="wait">
          {serverError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-md bg-destructive/5 p-3 text-xs text-destructive font-medium border border-destructive/20"
            >
              {serverError}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-10 text-sm font-medium shadow-none hover:shadow-sm transition-all"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Creating...
              </span>
            ) : (
              "Create World"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
