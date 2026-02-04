import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DocsCodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function DocsCodeBlock({ code, language = "bash", className }: DocsCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "group relative my-6 overflow-hidden rounded-lg border border-border/60 bg-muted/30",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          {language}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6 text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <div className="relative">
        <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

interface DocsStepHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Step header that automatically numbers itself when used inside a container with 'docs-step-container' class
 */
export function DocsStepHeader({ children, className }: DocsStepHeaderProps) {
  return (
    <div className={cn("docs-step-header flex items-center gap-4 mb-4 group", className)}>
      <div className="docs-step-number flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-[15px] font-black text-primary-foreground shadow-lg shadow-primary/20 transition-transform group-hover:scale-110" />
      <h2 className="text-2xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
        {children}
      </h2>
    </div>
  );
}

interface DocsHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DocsHeader({ children, className }: DocsHeaderProps) {
  return (
    <h2 className={cn("text-2xl font-bold tracking-tight text-foreground mb-6", className)}>
      {children}
    </h2>
  );
}
