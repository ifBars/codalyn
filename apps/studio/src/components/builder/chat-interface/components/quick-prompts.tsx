"use client";

interface QuickPromptsProps {
    onSelectPrompt: (prompt: string) => void;
}

const QUICK_PROMPTS = [
    "Design a pricing page with plans",
    "Build me a beautiful developer portfolio",
    "Prototype a hero + FAQ section",
    "Add dark mode toggle"
];

export function QuickPrompts({ onSelectPrompt }: QuickPromptsProps) {
    return (
        <div className="rounded border border-border bg-card p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Quick prompts
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
                {QUICK_PROMPTS.map((example) => (
                    <button
                        key={example}
                        onClick={() => onSelectPrompt(example)}
                        className="rounded border border-border bg-input px-3 py-2 text-left text-xs text-foreground transition hover:border-primary/50 hover:bg-card"
                    >
                        {example}
                    </button>
                ))}
            </div>
        </div>
    );
}

