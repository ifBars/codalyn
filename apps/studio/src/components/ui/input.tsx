import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground shadow-inner transition placeholder:text-muted-foreground focus:border-primary/80 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

