"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpRight, GitBranch, MoreHorizontal, Play, TimerReset, Edit2, Trash2 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { updateProject, deleteProject } from "@/lib/project-storage";

interface ProjectCardProps {
    project: {
        id: string;
        name: string;
        description?: string | null;
        status: string;
        updatedAt: Date | null;
        githubRepoUrl?: string | null;
    };
    onRefresh?: () => void;
}

export function ProjectCard({ project, onRefresh }: ProjectCardProps) {
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [newName, setNewName] = useState(project.name);
    const statusColors = {
        draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
        generating: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        ready: "bg-green-500/10 text-green-400 border-green-500/20",
        error: "bg-red-500/10 text-red-400 border-red-500/20",
    };

    const status = (project.status as keyof typeof statusColors) || "draft";

    const handleRename = () => {
        if (newName.trim() && newName.trim() !== project.name) {
            updateProject(project.id, { name: newName.trim() });
            setIsRenameOpen(false);
            onRefresh?.();
            // Trigger storage event to sync across tabs
            if (typeof window !== "undefined") {
                window.dispatchEvent(new StorageEvent("storage", {
                    key: "codalyn.projects.v1",
                }));
            }
        }
    };

    const handleDelete = () => {
        deleteProject(project.id);
        setIsDeleteOpen(false);
        onRefresh?.();
        // Trigger storage event to sync across tabs
        if (typeof window !== "undefined") {
            window.dispatchEvent(new StorageEvent("storage", {
                key: "codalyn.projects.v1",
            }));
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.2 }}
            className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] transition-all hover:border-white/10 hover:bg-white/[0.04] hover:shadow-2xl hover:shadow-black/50"
        >
            {/* Card Header / Preview Area */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-white/5 to-white/[0.02] p-6">
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-20" />

                <div className="relative z-10 flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between">
                        <Badge
                            variant="outline"
                            className={cn("backdrop-blur-md", statusColors[status])}
                        >
                            {project.status}
                        </Badge>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full bg-black/20 text-white/70 hover:bg-black/40 hover:text-white"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setNewName(project.name);
                                        setIsRenameOpen(true);
                                    }}
                                >
                                    <Edit2 className="mr-2 h-4 w-4" />
                                    Rename
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsDeleteOpen(true);
                                    }}
                                    className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <Link href={`/work/${project.id}`} className="w-full">
                            <Button className="w-full gap-2 bg-white text-black hover:bg-white/90">
                                <Play className="h-4 w-4 fill-current" />
                                Open Studio
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Card Content */}
            <div className="flex flex-1 flex-col p-5">
                <div className="mb-4">
                    <h3 className="font-semibold tracking-tight text-white group-hover:text-primary transition-colors">
                        {project.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {project.description || "No description provided."}
                    </p>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <TimerReset className="h-3.5 w-3.5" />
                        <span>
                            {project.updatedAt
                                ? new Date(project.updatedAt).toLocaleDateString()
                                : "Just now"}
                        </span>
                    </div>
                    {project.githubRepoUrl && (
                        <div className="flex items-center gap-1.5 text-blue-400/80">
                            <GitBranch className="h-3.5 w-3.5" />
                            <span>Linked</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Rename Dialog */}
            <Dialog 
                open={isRenameOpen} 
                onOpenChange={(open) => {
                    setIsRenameOpen(open);
                    if (!open) {
                        setNewName(project.name);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Project</DialogTitle>
                        <DialogDescription>
                            Enter a new name for your project.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleRename();
                                }
                                if (e.key === "Escape") {
                                    setIsRenameOpen(false);
                                    setNewName(project.name);
                                }
                            }}
                            placeholder="Project name"
                            className="w-full"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsRenameOpen(false);
                                setNewName(project.name);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRename}
                            disabled={!newName.trim() || newName.trim() === project.name}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Alert Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete
                            the project "{project.name}" and all of its data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    );
}
