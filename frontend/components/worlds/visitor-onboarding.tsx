"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  ArrowRight,
  Sparkles,
  Users,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Question {
  id: string;
  question: string;
  order: number;
}

interface VisitorPersona {
  name: string;
  age: number;
  story: string;
  traits: string[];
  imageBase64: string | null;
}

interface VisitorOnboardingProps {
  worldId: string;
  worldName: string;
  backdropUrl: string | null;
  onComplete: (persona: VisitorPersona) => void;
}

type OnboardingStep = "welcome" | "questions" | "generating" | "reveal";

export function VisitorOnboarding({
  worldId,
  worldName,
  backdropUrl,
  onComplete,
}: VisitorOnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [persona, setPersona] = useState<VisitorPersona | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch questions when moving to questions step
  useEffect(() => {
    if (step === "questions" && questions.length === 0) {
      fetchQuestions();
    }
  }, [step]);

  const fetchQuestions = async () => {
    const fallbackQuestions = [
      { id: "1", question: "What brings you here today?", order: 1 },
      {
        id: "2",
        question: "What kind of products interest you most?",
        order: 2,
      },
      {
        id: "3",
        question: "How would you describe your shopping style?",
        order: 3,
      },
    ];

    try {
      const res = await fetch(`/api/worlds/${worldId}/questions`);
      const data = await res.json();
      const fetchedQuestions = data.questions || [];
      // Use fallback questions if no questions exist for this world
      setQuestions(
        fetchedQuestions.length > 0 ? fetchedQuestions : fallbackQuestions
      );
    } catch (error) {
      console.error("Failed to fetch questions:", error);
      // Use fallback questions on error
      setQuestions(fallbackQuestions);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const allQuestionsAnswered = questions.every(
    (q) => answers[q.id]?.trim().length > 0
  );

  const handleSubmitAnswers = async () => {
    if (!allQuestionsAnswered) return;

    setStep("generating");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/worlds/${worldId}/visitor-persona`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: questions.map((q) => ({
            question: q.question,
            answer: answers[q.id],
          })),
        }),
      });

      const data = await res.json();
      if (data.persona) {
        setPersona(data.persona);
        setStep("reveal");
      }
    } catch (error) {
      console.error("Failed to generate persona:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterWorld = () => {
    if (persona) {
      onComplete(persona);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Semi-transparent overlay - lets the world with characters show through */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />

      {/* Content */}
      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 max-w-lg px-6 text-center"
          >
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-4 text-4xl font-bold tracking-tight text-white"
            >
              Welcome to {worldName}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mb-3 text-lg text-white/70"
            >
              Step into a world of fellow customers.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mb-8 flex flex-col items-center gap-3 text-white/60"
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span className="text-sm">Chat with real buyer personas</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">
                  Get authentic product recommendations
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                size="lg"
                onClick={() => setStep("questions")}
                className="group gap-2 bg-white px-8 text-black hover:bg-white/90"
              >
                Enter the World
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          </motion.div>
        )}

        {step === "questions" && (
          <motion.div
            key="questions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 w-full max-w-md px-6"
          >
            <div className="rounded-2xl border border-white/10 bg-black/60 p-6 shadow-2xl backdrop-blur-xl">
              <div className="mb-6 text-center">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 ring-1 ring-white/10">
                  <Sparkles className="h-6 w-6 text-violet-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">
                  Tell us about yourself
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  We&apos;ll create your unique visitor persona
                </p>
              </div>

              <div className="space-y-4">
                {questions.map((q, index) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      {q.question}
                    </label>
                    <Textarea
                      value={answers[q.id] || ""}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      placeholder="Your answer..."
                      className="min-h-[60px] resize-none border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/20"
                    />
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6"
              >
                <Button
                  size="lg"
                  onClick={handleSubmitAnswers}
                  disabled={!allQuestionsAnswered}
                  className="w-full gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50"
                >
                  Create My Persona
                  <Sparkles className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {step === "generating" && (
          <motion.div
            key="generating"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative z-10 text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 ring-1 ring-white/10"
            >
              <Loader2 className="h-10 w-10 text-violet-400" />
            </motion.div>
            <h2 className="text-xl font-semibold text-white">
              Crafting your persona...
            </h2>
            <p className="mt-2 text-sm text-white/50">
              Creating your unique character
            </p>
          </motion.div>
        )}

        {step === "reveal" && persona && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full max-w-sm px-6"
          >
            <div className="rounded-2xl border border-white/10 bg-black/60 p-6 shadow-2xl backdrop-blur-xl">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mx-auto mb-4 h-32 w-32 overflow-hidden rounded-full border-4 border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 shadow-lg shadow-violet-500/20"
              >
                {persona.imageBase64 ? (
                  <Image
                    src={persona.imageBase64}
                    alt={persona.name}
                    width={128}
                    height={128}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/50">
                    {persona.name[0]}
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center"
              >
                <h2 className="text-2xl font-bold text-white">
                  {persona.name}
                </h2>
                <p className="text-sm text-white/50">{persona.age} years old</p>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-4 text-center text-sm text-white/70"
              >
                {persona.story}
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 flex flex-wrap justify-center gap-2"
              >
                {persona.traits.map((trait, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70"
                  >
                    {trait}
                  </span>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-6"
              >
                <Button
                  size="lg"
                  onClick={handleEnterWorld}
                  className="w-full gap-2 bg-white text-black hover:bg-white/90"
                >
                  Enter as {persona.name}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
