import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group relative inline-flex items-center justify-center gap-2 rounded-full border font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 overflow-hidden",
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-gradient-to-r from-[#a0a0a0] via-[#c0c0c0] to-[#a0a0a0] bg-[length:200%_100%] text-white shadow-lg shadow-[#a0a0a0]/20 hover:bg-[position:100%_0] hover:shadow-xl hover:shadow-[#c0c0c0]/30 hover:scale-[1.02] active:scale-[0.98] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] before:transition-transform before:duration-700 hover:before:translate-x-[200%]",
        secondary:
          "border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/10 text-white/90 shadow-inner hover:from-white/15 hover:via-white/10 hover:to-white/15 hover:text-white hover:border-white/20 hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm",
        outline:
          "border-[#b0b0b0]/30 bg-transparent text-[#c0c0c0] hover:bg-gradient-to-r hover:from-[#a0a0a0]/10 hover:via-[#c0c0c0]/10 hover:to-[#a0a0a0]/10 hover:border-[#c0c0c0]/50 hover:text-white hover:shadow-lg hover:shadow-[#b0b0b0]/10 hover:scale-[1.02] active:scale-[0.98]",
        subtle:
          "border-transparent bg-white/5 text-muted-foreground hover:bg-gradient-to-r hover:from-white/10 hover:via-white/15 hover:to-white/10 hover:text-foreground hover:scale-[1.02] active:scale-[0.98]",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-gradient-to-r hover:from-white/5 hover:via-white/10 hover:to-white/5 hover:text-foreground hover:scale-[1.02] active:scale-[0.98]",
        destructive:
          "border-transparent bg-gradient-to-r from-red-600 via-red-500 to-red-600 bg-[length:200%_100%] text-white shadow-lg shadow-red-500/20 hover:bg-[position:100%_0] hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]",
        metallic:
          "border-[#b0b0b0]/40 bg-gradient-to-br from-[#a0a0a0] via-[#c0c0c0] to-[#b0b0b0] text-white shadow-lg shadow-[#a0a0a0]/30 hover:shadow-xl hover:shadow-[#c0c0c0]/40 hover:scale-[1.02] active:scale-[0.98] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:translate-x-[-200%] before:transition-transform before:duration-500 hover:before:translate-x-[200%] after:absolute after:inset-[1px] after:rounded-full after:bg-gradient-to-br after:from-[#a0a0a0] after:via-[#c0c0c0] after:to-[#b0b0b0] after:-z-10",
      },
      size: {
        xs: "h-7 px-3 text-xs",
        sm: "h-9 px-4 text-sm",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> { }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { buttonVariants };

