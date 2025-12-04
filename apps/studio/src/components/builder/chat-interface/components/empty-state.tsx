"use client";

import Link from "next/link";
import { ArrowUp } from "lucide-react";

export function EmptyState() {
    return (
        <div className="rounded border border-dashed border-border bg-card px-4 py-4 text-xs text-card-foreground">
            <p className="font-medium text-foreground">Projects stay on this device</p>
            <p className="mt-1 text-muted-foreground">
                Create a project from the dashboard to capture AI diffs, metadata, and source files.
            </p>
            <Link
                href="/projects"
                className="mt-3 inline-flex items-center gap-1.5 text-primary hover:text-primary/80"
            >
                <span>Open projects</span>
                <ArrowUp className="h-3 w-3 rotate-45" />
            </Link>
        </div>
    );
}

