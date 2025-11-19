import { useEffect, useState, useRef } from "react";

interface UseTypewriterPlaceholderOptions {
  placeholders: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  isActive?: boolean;
}

export function useTypewriterPlaceholder({
  placeholders,
  typingSpeed = 50,
  deletingSpeed = 30,
  pauseDuration = 2000,
  isActive = true,
}: UseTypewriterPlaceholderOptions): string {
  const [displayedText, setDisplayedText] = useState("");
  const placeholderIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const isDeletingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(isActive);

  // Keep ref in sync with prop
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    if (!isActive || placeholders.length === 0) {
      setDisplayedText("");
      placeholderIndexRef.current = 0;
      charIndexRef.current = 0;
      isDeletingRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    const animate = () => {
      if (!isActiveRef.current) {
        return;
      }

      const currentPlaceholder = placeholders[placeholderIndexRef.current];
      const currentCharIndex = charIndexRef.current;
      const isDeleting = isDeletingRef.current;

      if (!isDeleting) {
        // Typing phase
        if (currentCharIndex < currentPlaceholder.length) {
          setDisplayedText(currentPlaceholder.slice(0, currentCharIndex + 1));
          charIndexRef.current = currentCharIndex + 1;
          timeoutRef.current = setTimeout(animate, typingSpeed);
        } else {
          // Finished typing, pause then start deleting
          timeoutRef.current = setTimeout(() => {
            if (isActiveRef.current) {
              isDeletingRef.current = true;
              animate();
            }
          }, pauseDuration);
        }
      } else {
        // Deleting phase
        if (currentCharIndex > 0) {
          setDisplayedText(currentPlaceholder.slice(0, currentCharIndex - 1));
          charIndexRef.current = currentCharIndex - 1;
          timeoutRef.current = setTimeout(animate, deletingSpeed);
        } else {
          // Finished deleting, move to next placeholder
          isDeletingRef.current = false;
          placeholderIndexRef.current = (placeholderIndexRef.current + 1) % placeholders.length;
          charIndexRef.current = 0;
          animate();
        }
      }
    };

    // Reset state when starting
    if (charIndexRef.current === 0 && !isDeletingRef.current) {
      charIndexRef.current = 0;
      isDeletingRef.current = false;
    }

    animate();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isActive, placeholders, typingSpeed, deletingSpeed, pauseDuration]);

  return displayedText;
}

