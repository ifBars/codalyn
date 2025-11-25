"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Sparkles,
    FileCode2,
    Layers,
    CheckCircle2,
    ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProject, type StoredProject } from "@/lib/project-storage";
import { defaultProjectFileMap } from "@/lib/project-template";

interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    techStack: string[];
    fileCount: number;
    preview: string;
    popular?: boolean;
}

const templates: ProjectTemplate[] = [
    {
        id: "vite-react-ts",
        name: "Vite + React",
        description: "Modern React app with TypeScript, Tailwind CSS, and Vite build tool",
        icon: "⚡",
        techStack: ["React 18", "TypeScript", "Tailwind CSS", "Vite"],
        fileCount: Object.keys(defaultProjectFileMap).length,
        preview: "A minimal, production-ready React starter with modern tooling",
        popular: true,
    },
];

export default function TemplatesPage() {
    const router = useRouter();
    const [isCreating, setIsCreating] = useState<string | null>(null);

    const handleUseTemplate = async (template: ProjectTemplate) => {
        setIsCreating(template.id);

        try {
            // Create a new project with the template
            const project: StoredProject = createProject({
                name: `${template.name} Project`,
                description: `New project based on ${template.name} template`,
            });

            // Navigate to the builder with the new project
            router.push(`/builder?project=${project.id}`);
        } catch (error) {
            console.error("Failed to create project:", error);
            setIsCreating(null);
        }
    };

    return (
        <div className="space-y-8">
            <section className="rounded-[32px] border border-white/5 bg-white/5 p-8 shadow-surface-lg backdrop-blur-xl md:p-10">
                <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-4">
                        <Badge variant="info" className="w-fit uppercase tracking-widest">
                            Templates
                        </Badge>
                        <div className="space-y-3 text-balance">
                            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                                Start with a proven foundation
                            </h1>
                            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                                Choose from curated project templates optimized for modern web
                                development. Each template includes best practices, TypeScript
                                support, and a complete build pipeline ready to deploy.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        icon={Layers}
                        label="Available templates"
                        value={templates.length}
                        detail="Curated for production use"
                    />
                    <StatCard
                        icon={FileCode2}
                        label="Total files"
                        value={templates.reduce((acc, t) => acc + t.fileCount, 0)}
                        detail="Across all templates"
                    />
                    <StatCard
                        icon={CheckCircle2}
                        label="Type-safe"
                        value="100%"
                        detail="Full TypeScript coverage"
                    />
                    <StatCard
                        icon={Sparkles}
                        label="Build tool"
                        value="Vite"
                        detail="Lightning-fast HMR"
                    />
                </div>
            </section>

            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Browse templates</h2>
                    <Badge variant="outline" className="uppercase tracking-widest">
                        {templates.length} {templates.length === 1 ? "template" : "templates"}
                    </Badge>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                        <TemplateCard
                            key={template.id}
                            template={template}
                            onUse={() => handleUseTemplate(template)}
                            isCreating={isCreating === template.id}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}

function TemplateCard({
    template,
    onUse,
    isCreating,
}: {
    template: ProjectTemplate;
    onUse: () => void;
    isCreating: boolean;
}) {
    return (
        <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] p-6 shadow-surface-lg transition-all duration-300 hover:scale-[1.02] hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
            {template.popular && (
                <div className="absolute right-4 top-4">
                    <Badge variant="accent" className="text-xs uppercase tracking-wider">
                        Popular
                    </Badge>
                </div>
            )}

            <div className="space-y-4">
                {/* Icon */}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-primary/20 to-primary/5 text-4xl backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                    {template.icon}
                </div>

                {/* Content */}
                <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">
                        {template.name}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {template.description}
                    </p>
                </div>

                {/* Preview */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <p className="text-xs italic text-muted-foreground">
                        "{template.preview}"
                    </p>
                </div>

                {/* Tech Stack */}
                <div className="flex flex-wrap gap-2">
                    {template.techStack.map((tech) => (
                        <Badge
                            key={tech}
                            variant="outline"
                            className="border-white/10 bg-white/5 text-xs"
                        >
                            {tech}
                        </Badge>
                    ))}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <FileCode2 className="h-3.5 w-3.5" />
                        <span>{template.fileCount} files</span>
                    </div>
                </div>

                {/* Action Button */}
                <Button
                    onClick={onUse}
                    disabled={isCreating}
                    className={cn(
                        "group/btn w-full gap-2 rounded-full transition-all duration-300",
                        isCreating && "cursor-not-allowed opacity-50"
                    )}
                    size="lg"
                >
                    {isCreating ? (
                        <>
                            <Sparkles className="h-4 w-4 animate-spin" />
                            Creating project...
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover/btn:rotate-12" />
                            Use template
                            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

function StatCard({
    icon: Icon,
    label,
    value,
    detail,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    detail: string;
}) {
    return (
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] px-6 py-5 shadow-surface-lg transition-all hover:bg-white/[0.04]">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                    <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
                        {label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{value}</p>
                </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
        </div>
    );
}
