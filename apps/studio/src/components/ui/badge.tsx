import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition duration-200",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/5 text-foreground",
        outline: "border-white/20 text-muted-foreground",
        accent: "border-transparent bg-accent/15 text-accent-foreground",
        success: "border-transparent bg-success/15 text-success-foreground",
        warning: "border-transparent bg-warning/15 text-warning-foreground",
        info: "border-transparent bg-info/15 text-info-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({
  className,
  variant,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { badgeVariants };

