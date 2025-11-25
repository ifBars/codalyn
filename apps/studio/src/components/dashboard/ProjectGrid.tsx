"use client";

import { useState } from "react";
import { ProjectCard } from "./ProjectCard";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface ProjectGridProps {
    projects: any[];
    onRefresh?: () => void;
}

export function ProjectGrid({ projects, onRefresh }: ProjectGridProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredProjects = projects.filter((project) =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8">
            {/* Toolbar */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 border-white/10 bg-white/5 focus-visible:ring-primary/20 rounded-xl"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl border-white/10 bg-white/5 text-muted-foreground hover:text-white">
                        <SlidersHorizontal className="h-4 w-4" />
                        Filter
                    </Button>
                </div>
            </div>

            {/* Grid */}
            {filteredProjects.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredProjects.map((project) => (
                        <ProjectCard key={project.id} project={project} onRefresh={onRefresh} />
                    ))}
                </div>
            ) : (
                <div className="flex h-[400px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] text-center">
                    <div className="rounded-full bg-white/5 p-4">
                        <Search className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium text-white">No projects found</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Try adjusting your search or create a new project.
                    </p>
                </div>
            )}
        </div>
    );
}
