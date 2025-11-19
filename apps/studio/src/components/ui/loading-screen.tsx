"use client";

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
}

export function LoadingScreen({ message = "Loading...", submessage }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Animated logo - stylized "C" */}
      <div className="relative mb-12">
        <div className="relative flex h-56 w-56 items-center justify-center">
          {/* Outer glow rings - silver to match logo */}
          <div className="absolute inset-2 rounded-full bg-white/10 blur-2xl animate-pulse" />
          <div 
            className="absolute inset-2 rounded-full bg-white/5 blur-xl animate-pulse" 
            style={{ animationDelay: "0.5s" }}
          />
          
          {/* Rotating arc around the logo */}
          <svg 
            className="absolute inset-1 animate-spin"
            style={{ animationDuration: "2s" }}
            viewBox="0 0 208 208"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="104"
              cy="104"
              r="50"
              fill="none"
              stroke="rgba(192, 192, 192, 0.6)"
              strokeWidth="2.5"
              strokeOpacity="0.6"
              strokeDasharray="50 125"
              strokeLinecap="round"
            />
          </svg>
          
          {/* Logo image - larger and centered */}
          <div className="relative flex h-48 w-48 items-center justify-center">
            <img src="/logo.png" alt="Codalyn" className="h-full w-full object-contain" />
          </div>
        </div>
      </div>

      {/* Loading text */}
      <div className="space-y-3 text-center">
        <p className="text-xl font-medium text-muted-foreground/80">
          {message}
        </p>
        {submessage && (
          <p className="text-sm text-muted-foreground/60">
            {submessage}
          </p>
        )}
      </div>

      {/* Progress dots */}
      <div className="mt-10 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full bg-primary/40 animate-pulse"
            style={{
              animationDuration: "1.4s",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

