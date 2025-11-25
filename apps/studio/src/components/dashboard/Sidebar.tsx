"use client";

import { cn } from "@/lib/utils";
import {
    FolderKanban,
    Settings,
    Plus,
    LayoutGrid,
    HelpCircle,
    LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SpinningLogo } from "@/components/landing/SpinningLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SidebarProps {
    userEmail?: string;
}

export function Sidebar({ userEmail }: SidebarProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const pathname = usePathname();

    // Debounce hover to prevent flickering
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (isHovered) {
            // Instant open for responsiveness
            setIsExpanded(true);
        } else {
            // Short delay before closing to prevent accidental closing
            timeout = setTimeout(() => setIsExpanded(false), 300);
        }
        return () => clearTimeout(timeout);
    }, [isHovered]);

    const navLinks = [
        {
            name: "Projects",
            href: "/projects",
            icon: FolderKanban,
        },
        {
            name: "Templates",
            href: "/templates",
            icon: LayoutGrid,
        },
        {
            name: "Settings",
            href: "/settings",
            icon: Settings,
        },
    ];

    const bottomLinks = [
        {
            name: "Help & Support",
            href: "/help",
            icon: HelpCircle,
        },
    ];

    return (
        <motion.aside
            initial={{ width: "80px" }}
            animate={{ width: isExpanded ? "280px" : "80px" }}
            transition={{ 
                type: "tween",
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1]
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl",
                isExpanded ? "shadow-2xl shadow-black/50" : ""
            )}
        >
            {/* Logo Section */}
            <motion.div 
                className="flex h-20 items-center"
                animate={{ 
                    paddingLeft: isExpanded ? "1.25rem" : "0",
                    paddingRight: isExpanded ? "1.25rem" : "0",
                    justifyContent: isExpanded ? "flex-start" : "center"
                }}
                transition={{ type: "tween", duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
                <Link href="/" className="flex items-center overflow-hidden">
                    <motion.div 
                        className="flex h-14 w-14 shrink-0 items-center justify-center"
                        animate={{ marginRight: isExpanded ? "0.75rem" : "0" }}
                        transition={{ type: "tween", duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    >
                        <SpinningLogo className="h-full w-full text-primary" />
                    </motion.div>
                    <motion.div
                        className="flex flex-col whitespace-nowrap overflow-hidden"
                        animate={{ 
                            opacity: isExpanded ? 1 : 0,
                            x: isExpanded ? 0 : -10,
                            width: isExpanded ? 150 : 0
                        }}
                        transition={{ type: "tween", duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    >
                        <span className="text-sm font-bold tracking-wide text-white">
                            Codalyn
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Studio Beta
                        </span>
                    </motion.div>
                </Link>
            </motion.div>

            {/* New Project Button */}
            <div className="px-4 py-2">
                <Link href="/projects/new">
                    <Button
                        variant={isExpanded ? "primary" : "ghost"}
                        size="md"
                        className={cn(
                            "w-full h-10 gap-3",
                            isExpanded ? "justify-start" : "justify-center bg-white/5 hover:bg-white/10"
                        )}
                    >
                        <Plus className="h-5 w-5 shrink-0" />
                        <motion.span
                            className="overflow-hidden whitespace-nowrap"
                            animate={{ 
                                opacity: isExpanded ? 1 : 0,
                                width: isExpanded ? 110 : 0
                            }}
                            transition={{ type: "tween", duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        >
                            New Project
                        </motion.span>
                    </Button>
                </Link>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 space-y-2 px-4 py-6">
                {navLinks.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "h-5 w-5 shrink-0 transition-colors",
                                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-white"
                                )}
                            />
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="whitespace-nowrap"
                                    >
                                        {item.name}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            {isActive && isExpanded && (
                                <motion.div
                                    layoutId="active-pill"
                                    className="absolute right-4 h-1.5 w-1.5 rounded-full bg-primary"
                                />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Section */}
            <div className="border-t border-white/5 bg-black/20 p-4">
                <div className="space-y-1">
                    {bottomLinks.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
                        >
                            <item.icon className="h-5 w-5 shrink-0" />
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="whitespace-nowrap"
                                    >
                                        {item.name}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </Link>
                    ))}
                </div>

                {/* User Profile */}
                <div className={cn("mt-4 flex items-center gap-3 rounded-xl transition-all", isExpanded ? "bg-white/5 p-3" : "justify-center")}>
                    <Avatar className="h-9 w-9 border border-white/10">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-xs text-white">
                            {userEmail?.slice(0, 2).toUpperCase() || "US"}
                        </AvatarFallback>
                    </Avatar>
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: "auto" }}
                                exit={{ opacity: 0, width: 0 }}
                                className="flex flex-1 flex-col overflow-hidden"
                            >
                                <span className="truncate text-sm font-medium text-white">
                                    {userEmail || "User"}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                    Pro Plan
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {isExpanded && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                            <LogOut className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </motion.aside>
    );
}
