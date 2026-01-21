"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Bot,
  Zap,
  Blocks,
  ArrowRight,
  Search,
  FileText,
  MessageSquare,
  Workflow,
  Play,
} from "lucide-react";
import { Header } from "@/components/Header";

const demoPrompts = [
  {
    prefix: "Create an agent that",
    text: "takes a topic and searches multiple sources to compile a comprehensive research summary with citations...",
  },
  {
    prefix: "Create an agent that",
    text: "monitors social media mentions and analyzes sentiment in real-time, alerting you to trending topics...",
  },
  {
    prefix: "Create an agent that",
    text: "reads your emails, categorizes them by priority, and drafts appropriate responses...",
  },
  {
    prefix: "Create an agent that",
    text: "converts natural language queries into SQL and executes them against your database...",
  },
  {
    prefix: "Create an agent that",
    text: "summarizes meeting transcripts and extracts action items with assigned owners and deadlines...",
  },
];

const features = [
  {
    title: "Natural Language",
    description: "Describe your agent in plain English. No coding required to get started.",
    icon: MessageSquare,
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/10",
  },
  {
    title: "Visual Builder",
    description: "Fine-tune your agent with an intuitive drag-and-drop canvas interface.",
    icon: Blocks,
    colorClass: "text-green-500",
    bgClass: "bg-green-500/10",
  },
  {
    title: "Instant Deployment",
    description: "Deploy your agents with one click. Access them via API or web interface.",
    icon: Zap,
    colorClass: "text-yellow-500",
    bgClass: "bg-yellow-500/10",
  },
];

const useCases = [
  {
    title: "Research Assistant",
    description: "Automatically search, analyze, and compile information from multiple sources into comprehensive summaries.",
    icon: Search,
    colorClass: "text-blue-500",
  },
  {
    title: "Document Processor",
    description: "Extract key insights, summarize content, and transform documents into actionable data.",
    icon: FileText,
    colorClass: "text-red-500",
  },
  {
    title: "Custom Workflows",
    description: "Chain multiple AI capabilities together to automate complex multi-step processes.",
    icon: Workflow,
    colorClass: "text-green-500",
  },
];

const steps = [
  {
    number: "01",
    title: "Describe",
    description: "Tell us what you want your agent to do.",
    colorClass: "text-blue-500",
  },
  {
    number: "02",
    title: "Customize",
    description: "Refine your agent using the visual canvas editor.",
    colorClass: "text-green-500",
  },
  {
    number: "03",
    title: "Deploy",
    description: "Launch your agent and integrate it anywhere.",
    colorClass: "text-yellow-500",
  },
];

export default function LandingPage() {
  const [currentPromptIndex, setCurrentPromptIndex] = React.useState(0);
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentPromptIndex((prev) => (prev + 1) % demoPrompts.length);
        setIsAnimating(false);
      }, 300);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const currentPrompt = demoPrompts[currentPromptIndex];

  return (
    <div className="min-h-screen bg-background">
      <Header showUserMenu={true} />

      {/* Hero Section */}
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm">
          <Sparkles size={16} className="text-blue-500" />
          <span className="text-muted-foreground">AI-Powered Agent Builder</span>
        </div>
        
        <h1 className="mb-6 text-5xl font-normal tracking-tight sm:text-6xl">
          Build <span className="text-blue-500">AI agents</span> with
          <br />
          <span className="text-green-500">natural language</span>
        </h1>
        
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
          Describe what you want your agent to do, and Conscience will generate it for you.
          No coding required. Customize with a visual editor, deploy instantly.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/build"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-blue-500 px-8 text-base font-medium text-white transition-all hover:shadow-lg hover:shadow-blue-500/25"
          >
            <Sparkles size={18} />
            Start Building
          </Link>
          {/* <Link
            href="/canvas"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-8 text-base font-medium transition-all hover:shadow-md"
          >
            <Play size={18} className="text-green-500" />
            Try the Canvas
          </Link> */}
        </div>
      </section>

      {/* Demo Preview */}
      <section className="mx-auto max-w-4xl px-4 pb-20">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
          <div className="border-b border-border/40 bg-muted/30 px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="ml-4 text-sm text-muted-foreground">Conscience Builder</span>
            </div>
          </div>
          <div className="p-8">
            <div className="mb-6 rounded-2xl border border-border/60 bg-background/50 p-5 min-h-[72px]">
              <p
                className={`text-muted-foreground transition-all duration-300 ${
                  isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                }`}
              >
                <span className="text-foreground">{currentPrompt.prefix}</span>{" "}
                {currentPrompt.text}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex h-10 items-center gap-2 rounded-full bg-muted/50 px-4 text-sm text-muted-foreground">
                <Bot size={16} />
                GPT-4o
              </div>
              {/* Progress indicators */}
              <div className="flex items-center gap-1.5">
                {demoPrompts.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setIsAnimating(true);
                      setTimeout(() => {
                        setCurrentPromptIndex(index);
                        setIsAnimating(false);
                      }, 300);
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === currentPromptIndex
                        ? "w-6 bg-blue-500"
                        : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    aria-label={`View example ${index + 1}`}
                  />
                ))}
              </div>
              <div className="flex h-10 items-center gap-2 rounded-full bg-blue-500 px-6 text-sm font-medium text-white">
                <Sparkles size={16} />
                Generate
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border/40 bg-muted/20 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-normal tracking-tight">
              Everything you need to build <span className="text-blue-500">intelligent agents</span>
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              From idea to deployment in minutes. Conscience provides all the tools you need.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-md"
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${feature.bgClass}`}>
                  <feature.icon size={24} className={feature.colorClass} />
                </div>
                <h3 className="mb-2 text-lg font-medium">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-normal tracking-tight">
              How it <span className="text-green-500">works</span>
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Three simple steps to create and deploy your AI agent.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.number} className="relative text-center">
                <div className={`mb-4 text-5xl font-bold ${step.colorClass} opacity-20`}>
                  {step.number}
                </div>
                <h3 className="mb-2 text-xl font-medium">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
                {index < steps.length - 1 && (
                  <ArrowRight
                    size={24}
                    className="absolute right-0 top-8 hidden text-border md:block -translate-x-1/2"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="border-t border-border/40 bg-muted/20 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-normal tracking-tight">
              Built for <span className="text-yellow-500">any use case</span>
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              From simple tasks to complex workflows, Conscience adapts to your needs.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {useCases.map((useCase) => (
              <div
                key={useCase.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-md"
              >
                <useCase.icon size={24} className={`mb-4 ${useCase.colorClass}`} />
                <h3 className="mb-2 text-lg font-medium">{useCase.title}</h3>
                <p className="text-sm text-muted-foreground">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10">
            <Bot size={32} className="text-blue-500" />
          </div>
          <h2 className="mb-4 text-3xl font-normal tracking-tight">
            Ready to build your first <span className="text-blue-500">agent</span>?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Join developers and teams building the next generation of AI-powered applications.
          </p>
          <Link
            href="/build"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-blue-500 px-8 text-base font-medium text-white transition-all hover:shadow-lg hover:shadow-blue-500/25"
          >
            Get Started Free
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Workflow size={20} className="text-blue-500" />
              <span className="font-medium">Conscience</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Build intelligent AI agents with natural language.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
