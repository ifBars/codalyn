"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Share2, Github, ArrowUpRight, Lock, X, AlertCircle, Sparkles, RefreshCw } from "lucide-react";
import { WebContainerManager } from "@/lib/webcontainer-manager";
import { getProjectById, applyFileOperationsToProject } from "@/lib/project-storage";
import { registerIframe } from "@/lib/screenshot";

interface PreviewProps {
  projectId: string;
  onRequestFix?: (errors: string) => void;
}

export default function Preview({ projectId, onRequestFix }: PreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const errorCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasErrorsRef = useRef(false);

  // Register iframe ref globally for screenshot capture
  useEffect(() => {
    const iframe = frameRef.current;
    if (iframe && previewUrl) {
      registerIframe(iframe);
    }
    return () => {
      registerIframe(null);
    };
  }, [previewUrl]);

  useEffect(() => {
    async function init() {
      try {
        // Check if there's a saved project with files
        const savedProject = getProjectById(projectId);
        const savedFiles = savedProject?.files;
        
        // Pass saved files to initProject so dependencies are preserved
        const { url } = await WebContainerManager.initProject(savedFiles);
        setPreviewUrl(url);
        
        // Check for vite.config.ts errors after a delay and save fixed version
        // This gives Vite time to start and potentially fail
        setTimeout(async () => {
          try {
            // Check if vite.config.ts has the problematic path import
            const viteConfig = await WebContainerManager.readFile("vite.config.ts").catch(() => null);
            if (viteConfig) {
              const hasPathIssue = viteConfig.includes("import path") || 
                                   viteConfig.includes("require('path')") ||
                                   viteConfig.includes('path.resolve');
              
              if (hasPathIssue) {
                console.log('[Preview] Detected problematic vite.config.ts, fixing...');
                await WebContainerManager.fixPathAliasConfig();
                
                // Read the fixed config and save it to project storage
                const fixedConfig = await WebContainerManager.readFile("vite.config.ts").catch(() => null);
                if (fixedConfig && savedProject) {
                  applyFileOperationsToProject(savedProject.id, [{
                    type: "write",
                    path: "vite.config.ts",
                    content: fixedConfig,
                  }]);
                  console.log('[Preview] Saved fixed vite.config.ts to project storage');
                }
                
                // Refresh after fixing
                setTimeout(() => {
                  if (frameRef.current) {
                    handleRefresh();
                  }
                }, 2000);
              }
            }
          } catch (e) {
            // Ignore errors checking config
            console.warn('[Preview] Error checking/fixing vite.config.ts:', e);
          }
        }, 5000);
      } catch (error) {
        console.error("Failed to initialize WebContainer", error);
        setErrors([`Failed to initialize WebContainer: ${error instanceof Error ? error.message : String(error)}`]);
        setShowErrorPopup(true);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [projectId]);

  // Monitor iframe for Vite errors
  useEffect(() => {
    if (!previewUrl || !frameRef.current) return;

    let mutationObserver: MutationObserver | null = null;
    let consoleErrorListener: ((event: MessageEvent) => void) | null = null;

    const findErrorOverlay = (doc: Document): Element | null => {
      // Try multiple strategies to find Vite error overlay
      // Vite typically injects error overlays with specific patterns
      
      const win = doc.defaultView || window;
      
      // Strategy 1: Look for common Vite error overlay selectors
      const selectors = [
        '.vite-error-overlay',
        '[class*="vite-error"]',
        '[class*="ErrorOverlay"]',
        '[id*="vite-error"]',
        '[id*="error-overlay"]',
        '[data-vite-error]',
        // Look for divs that contain error-like content and are positioned as overlays
        'div[style*="position: fixed"]',
        'div[style*="position:absolute"]',
        'div[style*="z-index"]',
      ];

      for (const selector of selectors) {
        const elements = doc.querySelectorAll(selector);
        for (const el of Array.from(elements)) {
          const text = el.textContent || '';
          // Check if element contains error indicators
          if (
            text.includes('Failed to resolve') ||
            text.includes('Error') ||
            text.includes('error') ||
            text.includes('Cannot') ||
            text.includes('plugin:vite') ||
            el.querySelector('[class*="error"]') ||
            el.querySelector('[class*="Error"]')
          ) {
            // Verify it's likely an overlay (has high z-index or covers significant area)
            try {
              const styles = win.getComputedStyle(el);
              const zIndex = parseInt(styles.zIndex) || 0;
              if (zIndex > 1000 || el.clientHeight > 100 || el.clientWidth > 100) {
                return el;
              }
            } catch (e) {
              // If getComputedStyle fails, still check size
              if (el.clientHeight > 100 || el.clientWidth > 100) {
                return el;
              }
            }
          }
        }
      }

      // Strategy 2: Look for elements with error text that are overlays
      const allDivs = doc.querySelectorAll('div');
      for (const div of Array.from(allDivs)) {
        const text = div.textContent || '';
        // More specific checks for Vite error patterns
        const hasViteError = 
          text.includes('Failed to resolve') ||
          text.includes('plugin:vite:import-analysis') ||
          text.includes('plugin:vite') ||
          (text.includes('Error') && text.includes('vite')) ||
          (text.includes('Failed to resolve import') && text.includes('.tsx')) ||
          (text.includes('Does the file exist?'));
        
        if (hasViteError) {
          try {
            const styles = win.getComputedStyle(div);
            const position = styles.position;
            const zIndex = parseInt(styles.zIndex) || 0;
            const innerHeight = win.innerHeight || 800;
            
            // Check if it's positioned as an overlay
            if (
              (position === 'fixed' || position === 'absolute') &&
              (zIndex > 1000 || div.clientHeight > innerHeight * 0.3)
            ) {
              return div;
            }
          } catch (e) {
            // If getComputedStyle fails, check if it's a large overlay-like element
            // Vite error overlays are typically quite large
            if (div.clientHeight > 200 && div.clientWidth > 200) {
              return div;
            }
          }
        }
      }

      // Strategy 3: Look for any element with Vite error text, regardless of positioning
      // This is a fallback for cases where the overlay might not be properly positioned
      const allElements = doc.querySelectorAll('*');
      for (const el of Array.from(allElements)) {
        const text = el.textContent || '';
        if (
          text.includes('Failed to resolve import') &&
          text.includes('plugin:vite') &&
          text.length > 100
        ) {
          // Check if it's visible and substantial
          try {
            const styles = win.getComputedStyle(el);
            if (styles.display !== 'none' && styles.visibility !== 'hidden') {
              if (el.clientHeight > 150 || el.clientWidth > 300) {
                return el;
              }
            }
          } catch (e) {
            // If we can't check styles, assume it's the error if it's large enough
            if (el.clientHeight > 150 || el.clientWidth > 300) {
              return el;
            }
          }
        }
      }

      return null;
    };

    const extractErrorMessages = (overlay: Element): string[] => {
      const errorMessages: string[] = [];
      const overlayText = overlay.textContent || '';
      
      if (!overlayText.trim()) return errorMessages;

      // Check for dependency errors first (special handling)
      const dependencyErrorMatch = overlayText.match(/The following dependencies are imported but could not be resolved:[\s\S]*?Are they installed\?/i);
      if (dependencyErrorMatch) {
        // Extract the full dependency error message
        const depErrorText = dependencyErrorMatch[0];
        errorMessages.push(depErrorText.trim());
        return errorMessages; // Return early for dependency errors
      }

      // Try to extract structured error information
      // Look for the main error message (usually in a header or first prominent element)
      const errorHeader = overlay.querySelector('h1, h2, [class*="title"], [class*="header"], [style*="color: rgb(255"]');
      if (errorHeader) {
        const headerText = errorHeader.textContent?.trim();
        if (headerText && headerText.length > 10) {
          errorMessages.push(headerText);
        }
      }

      // Extract file path and line number
      const filePathMatch = overlayText.match(/\/[^\s]+\.(tsx?|jsx?|ts|js):\d+:\d+/);
      if (filePathMatch) {
        const context = overlayText.substring(
          Math.max(0, overlayText.indexOf(filePathMatch[0]) - 50),
          Math.min(overlayText.length, overlayText.indexOf(filePathMatch[0]) + 200)
        );
        if (context && !errorMessages.includes(context)) {
          errorMessages.push(context.trim());
        }
      }

      // Extract code snippets (usually in pre or code tags)
      const codeBlocks = overlay.querySelectorAll('pre, code, [class*="code"]');
      codeBlocks.forEach((block) => {
        const codeText = block.textContent?.trim();
        if (codeText && codeText.length > 20 && !errorMessages.some(msg => msg.includes(codeText.substring(0, 50)))) {
          errorMessages.push(codeText);
        }
      });

      // If we didn't find structured errors, use the full text (but clean it up)
      if (errorMessages.length === 0 && overlayText.trim().length > 50) {
        // Remove common UI text like "Click outside" instructions
        const cleaned = overlayText
          .split('\n')
          .filter(line => {
            const trimmed = line.trim();
            return !trimmed.includes('Click outside') &&
                   !trimmed.includes('press Esc') &&
                   !trimmed.includes('disable this overlay') &&
                   trimmed.length > 5;
          })
          .join('\n')
          .trim();
        
        if (cleaned.length > 50) {
          errorMessages.push(cleaned.substring(0, 3000));
        }
      }

      return errorMessages;
    };

    const checkForErrors = () => {
      try {
        const iframe = frameRef.current;
        if (!iframe) return;

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc || !iframeDoc.body) return;

        const errorOverlay = findErrorOverlay(iframeDoc);
        
        if (errorOverlay) {
          const errorMessages = extractErrorMessages(errorOverlay);

          if (errorMessages.length > 0) {
            // Check for dependency errors in the messages
            const hasDependencyError = errorMessages.some(error => 
              error.includes('dependencies are imported but could not be resolved') ||
              error.includes('could not be resolved') ||
              error.includes('Are they installed?')
            );
            
            // Check if this is a path alias error and auto-fix it
            const isPathAliasError = errorMessages.some(error => 
              error.includes('Failed to resolve import') && 
              (error.includes('@/') || error.includes('@\\'))
            );
            
            if (isPathAliasError && !hasErrorsRef.current) {
              // Auto-fix path alias configuration (non-blocking)
              console.log('[Preview] Auto-detected path alias error, fixing configuration...');
              WebContainerManager.fixPathAliasConfig()
                .then(() => {
                  console.log('[Preview] Path alias configuration fixed, waiting for reload...');
                  // Wait for Vite to reload, then refresh
                  setTimeout(() => {
                    if (frameRef.current) {
                      try {
                        const iframeWindow = frameRef.current.contentWindow;
                        if (iframeWindow && iframeWindow.location) {
                          iframeWindow.location.reload();
                        }
                      } catch (e) {
                        // Fallback: reload via src manipulation
                        const url = new URL(previewUrl || '');
                        url.searchParams.set('_refresh', Date.now().toString());
                        if (frameRef.current) {
                          frameRef.current.src = url.toString();
                        }
                      }
                    }
                  }, 3000);
                })
                .catch((fixError) => {
                  console.error('[Preview] Failed to auto-fix path alias:', fixError);
                  // Show error popup if auto-fix fails
                  setErrors(errorMessages);
                  setShowErrorPopup(true);
                  hasErrorsRef.current = true;
                });
              // Don't show error popup immediately, wait for auto-fix to complete
              return;
            }
            
            // If it's a dependency error, try to auto-install missing packages
            if (hasDependencyError) {
              const allErrorText = errorMessages.join('\n');
              const missingPackages = WebContainerManager.extractMissingPackages(allErrorText);
              
              if (missingPackages.length > 0 && !hasErrorsRef.current) {
                // Auto-install missing packages (non-blocking)
                console.log(`[Preview] Auto-detected missing packages: ${missingPackages.join(', ')}`);
                console.log('[Preview] Attempting to auto-install missing packages...');
                
                WebContainerManager.installPackage(missingPackages)
                  .then(async (updatedPackageJson) => {
                    console.log(`[Preview] Successfully installed packages: ${missingPackages.join(', ')}`);
                    
                    // Save updated package.json to project storage
                    if (updatedPackageJson) {
                      try {
                        const savedProject = getProjectById(projectId);
                        if (savedProject) {
                          applyFileOperationsToProject(savedProject.id, [{
                            type: "write",
                            path: "package.json",
                            content: updatedPackageJson,
                          }]);
                          console.log(`[Preview] Saved updated package.json to project storage`);
                        }
                      } catch (saveError) {
                        console.warn(`[Preview] Failed to save package.json:`, saveError);
                      }
                    }
                    
                    // Wait for Vite to reload, then refresh preview
                    setTimeout(() => {
                      if (frameRef.current) {
                        try {
                          const iframeWindow = frameRef.current.contentWindow;
                          if (iframeWindow && iframeWindow.location) {
                            iframeWindow.location.reload();
                          }
                        } catch (e) {
                          // Fallback: reload via src manipulation
                          const url = new URL(previewUrl || '');
                          url.searchParams.set('_refresh', Date.now().toString());
                          if (frameRef.current) {
                            frameRef.current.src = url.toString();
                          }
                        }
                      }
                    }, 3000);
                  })
                  .catch((installError) => {
                    console.error('[Preview] Failed to auto-install packages:', installError);
                    // Show error popup if auto-install fails
                    setErrors(errorMessages);
                    setShowErrorPopup(true);
                    hasErrorsRef.current = true;
                    
                    // Hide the error overlay in the iframe
                    (errorOverlay as HTMLElement).style.display = 'none';
                    (errorOverlay as HTMLElement).style.visibility = 'hidden';
                    (errorOverlay as HTMLElement).style.opacity = '0';
                    (errorOverlay as HTMLElement).style.pointerEvents = 'none';
                  });
                // Don't show error popup immediately, wait for auto-install to complete
                hasErrorsRef.current = true; // Prevent duplicate attempts
                return;
              }
              
              // If we couldn't extract packages or auto-install already attempted, show popup
              setErrors(errorMessages);
              setShowErrorPopup(true);
              hasErrorsRef.current = true;
              
              // Hide the error overlay in the iframe
              (errorOverlay as HTMLElement).style.display = 'none';
              (errorOverlay as HTMLElement).style.visibility = 'hidden';
              (errorOverlay as HTMLElement).style.opacity = '0';
              (errorOverlay as HTMLElement).style.pointerEvents = 'none';
              return;
            }
            
            setErrors(errorMessages);
            setShowErrorPopup(true);
            hasErrorsRef.current = true;
            
            // Hide the error overlay in the iframe
            (errorOverlay as HTMLElement).style.display = 'none';
            (errorOverlay as HTMLElement).style.visibility = 'hidden';
            (errorOverlay as HTMLElement).style.opacity = '0';
            (errorOverlay as HTMLElement).style.pointerEvents = 'none';
          }
        } else {
          // No error overlay found, but check body text for errors anyway
          // Sometimes errors appear in body without a proper overlay
          try {
            const bodyText = iframeDoc.body?.textContent || '';
            const bodyHTML = iframeDoc.body?.innerHTML || '';
            
            // Check for dependency errors in body text
            if (bodyText.includes('dependencies are imported but could not be resolved') ||
                bodyText.includes('The following dependencies') ||
                bodyText.includes('Are they installed?') ||
                bodyHTML.includes('dependencies are imported')) {
              
              // Extract the error message
              const depErrorMatch = bodyText.match(/The following dependencies are imported but could not be resolved:[\s\S]*?Are they installed\?/i) ||
                                   bodyHTML.match(/The following dependencies are imported but could not be resolved:[\s\S]*?Are they installed\?/i);
              if (depErrorMatch && !hasErrorsRef.current) {
                setErrors([depErrorMatch[0].trim()]);
                setShowErrorPopup(true);
                hasErrorsRef.current = true;
                return;
              }
            }
            
            // Check for config errors
            if (bodyText.includes('failed to load config') ||
                bodyText.includes('Dynamic require') ||
                bodyText.includes('server restart failed') ||
                bodyHTML.includes('failed to load config') ||
                bodyHTML.includes('Dynamic require')) {
              
              if (!hasErrorsRef.current) {
                // Auto-fix vite.config.ts (non-blocking)
                console.log('[Preview] Auto-detected vite.config.ts error, fixing...');
                WebContainerManager.fixPathAliasConfig()
                  .then(() => {
                    console.log('[Preview] Fixed vite.config.ts, waiting for Vite to reload...');
                    // Wait for Vite to reload, then refresh
                    setTimeout(() => {
                      if (frameRef.current) {
                        try {
                          const iframeWindow = frameRef.current.contentWindow;
                          if (iframeWindow && iframeWindow.location) {
                            iframeWindow.location.reload();
                          }
                        } catch (e) {
                          // Fallback: reload via src manipulation
                          const url = new URL(previewUrl || '');
                          url.searchParams.set('_refresh', Date.now().toString());
                          if (frameRef.current) {
                            frameRef.current.src = url.toString();
                          }
                        }
                      }
                    }, 3000);
                  })
                  .catch((fixError) => {
                    console.error('[Preview] Failed to auto-fix vite.config.ts:', fixError);
                    // Show error popup if auto-fix fails
                    const configErrorMatch = bodyText.match(/(failed to load config[^\n]*|Dynamic require[^\n]*|server restart failed[^\n]*)/i) ||
                                                           bodyHTML.match(/(failed to load config[^<]*|Dynamic require[^<]*|server restart failed[^<]*)/i);
                    const errorMsg = configErrorMatch 
                      ? configErrorMatch[0] 
                      : 'Vite configuration error: Dynamic require of "path" is not supported. The vite.config.ts file needs to be fixed.';
                    
                    setErrors([errorMsg]);
                    setShowErrorPopup(true);
                    hasErrorsRef.current = true;
                  });
                // Don't show error popup immediately, wait for auto-fix to complete
                hasErrorsRef.current = true; // Prevent duplicate attempts
                return;
              }
            }
            
            // Check if page is blank or shows connection error (Vite didn't start)
            // This happens when vite.config.ts has errors
            if (iframeDoc.body && 
                (bodyText.trim().length < 50 || 
                 bodyText.includes('Unable to connect') ||
                 bodyText.includes('No server listening'))) {
              
              // Check if we've already shown an error for this
              if (!hasErrorsRef.current) {
                // Try to read vite.config.ts to see if it has the path issue
                WebContainerManager.readFile("vite.config.ts")
                  .then(config => {
                    if (config.includes("import path") || config.includes("require('path')") || config.includes('path.resolve')) {
                      // Auto-fix the config
                      console.log('[Preview] Detected path module usage in vite.config.ts, auto-fixing...');
                      WebContainerManager.fixPathAliasConfig()
                        .then(() => {
                          console.log('[Preview] Fixed vite.config.ts, waiting for Vite to reload...');
                          // Wait for Vite to reload, then refresh
                          setTimeout(() => {
                            if (frameRef.current) {
                              try {
                                const iframeWindow = frameRef.current.contentWindow;
                                if (iframeWindow && iframeWindow.location) {
                                  iframeWindow.location.reload();
                                }
                              } catch (e) {
                                // Fallback: reload via src manipulation
                                const url = new URL(previewUrl || '');
                                url.searchParams.set('_refresh', Date.now().toString());
                                if (frameRef.current) {
                                  frameRef.current.src = url.toString();
                                }
                              }
                            }
                          }, 3000);
                        })
                        .catch((fixError) => {
                          console.error('[Preview] Failed to auto-fix vite.config.ts:', fixError);
                          setErrors(['Vite configuration error: Dynamic require of "path" is not supported in WebContainer. The vite.config.ts file needs to be updated to use URL-based path resolution.']);
                          setShowErrorPopup(true);
                          hasErrorsRef.current = true;
                        });
                      hasErrorsRef.current = true; // Prevent duplicate attempts
                    }
                  })
                  .catch(() => {
                    // If we can't read config, show generic error
                    setErrors(['Vite server failed to start. This may be due to a configuration error in vite.config.ts.']);
                    setShowErrorPopup(true);
                    hasErrorsRef.current = true;
                  });
              }
            }
          } catch (e) {
            // Ignore errors when checking body text
          }
          
          // No error overlay detected, clear error state if we had errors (but only if no new errors found)
          // Don't clear if we just set errors above
          if (hasErrorsRef.current && errors.length === 0) {
            setErrors([]);
            setShowErrorPopup(false);
            hasErrorsRef.current = false;
          }
        }
      } catch (error) {
        // Cross-origin or other errors - ignore silently
        // This is expected if the iframe hasn't loaded yet or is cross-origin
      }
    };
    
    // Also listen for console errors from the iframe
    const setupConsoleErrorListener = () => {
      try {
        const iframe = frameRef.current;
        if (!iframe || !iframe.contentWindow) return;
        
        // Try to access console (may fail due to CORS)
        const iframeWindow = iframe.contentWindow;
        
        // Override console.error to catch errors
        // Note: This only works if we have same-origin access
        try {
          const iframeConsole = (iframeWindow as any).console;
          if (iframeConsole && iframeConsole.error) {
            const originalError = iframeConsole.error;
            iframeConsole.error = (...args: any[]) => {
              originalError.apply(iframeConsole, args);
              
              // Check if this is a dependency error
              const errorText = args.map(arg => 
                typeof arg === 'string' ? arg : JSON.stringify(arg)
              ).join(' ');
              
              if (errorText.includes('dependencies are imported but could not be resolved') ||
                  errorText.includes('could not be resolved') ||
                  errorText.includes('Are they installed?')) {
                
                if (!hasErrorsRef.current) {
                  setErrors([errorText]);
                  setShowErrorPopup(true);
                  hasErrorsRef.current = true;
                }
              }
            };
          }
        } catch (e) {
          // Can't override console (CORS), that's okay
          // We'll rely on DOM error overlay detection
        }
      } catch (error) {
        // Ignore CORS errors
      }
    };

    const injectErrorHidingStyles = (doc: Document) => {
      try {
        // Inject CSS to hide Vite error overlays
        const styleId = 'codalyn-error-hider';
        let styleEl = doc.getElementById(styleId);
        
        if (!styleEl) {
          styleEl = doc.createElement('style');
          styleEl.id = styleId;
          styleEl.textContent = `
            .vite-error-overlay,
            [class*="vite-error"],
            [class*="ErrorOverlay"],
            [id*="vite-error"],
            [id*="error-overlay"] {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
          `;
          doc.head.appendChild(styleEl);
        }
      } catch (error) {
        // Ignore if we can't inject styles
      }
    };

    const setupObserver = () => {
      try {
        const iframe = frameRef.current;
        if (!iframe) return;

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc || !iframeDoc.body) return;

        // Inject CSS to hide error overlays
        injectErrorHidingStyles(iframeDoc);

        // Use MutationObserver to detect when error overlay is added
        mutationObserver = new MutationObserver((mutations) => {
          // Re-inject styles in case they were removed
          injectErrorHidingStyles(iframeDoc);
          checkForErrors();
        });

        mutationObserver.observe(iframeDoc.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'id', 'style'],
        });

        // Set up console error listener
        setupConsoleErrorListener();

        // Also check immediately
        checkForErrors();
        
        // Poll for errors more aggressively to catch console errors
        // This helps catch errors that don't show up in DOM overlays
        const errorPollInterval = setInterval(() => {
          checkForErrors();
        }, 1000);
        
        // Store interval for cleanup
        if (errorCheckIntervalRef.current) {
          clearInterval(errorCheckIntervalRef.current);
        }
        errorCheckIntervalRef.current = errorPollInterval;
      } catch (error) {
        // Cross-origin - fall back to polling
        console.debug("MutationObserver not available, using polling");
      }
    };

    // Wait for iframe to load
    const iframe = frameRef.current;
    const loadHandler = () => {
      // Check immediately, then set up observer and polling
      setTimeout(() => {
        checkForErrors();
        setupObserver();
        // Also set up polling as fallback - check frequently
        errorCheckIntervalRef.current = setInterval(checkForErrors, 300);
      }, 500);
    };
    
    if (iframe) {
      iframe.addEventListener('load', loadHandler);
      // If already loaded, set up immediately
      if (iframe.contentDocument?.readyState === 'complete') {
        setTimeout(() => {
          checkForErrors();
          setupObserver();
          errorCheckIntervalRef.current = setInterval(checkForErrors, 300);
        }, 200);
      } else {
        // Start checking immediately even before load
        const immediateCheck = setInterval(() => {
          if (iframe.contentDocument?.readyState === 'complete') {
            clearInterval(immediateCheck);
            checkForErrors();
            setupObserver();
            errorCheckIntervalRef.current = setInterval(checkForErrors, 300);
          }
        }, 100);
        
        // Cleanup immediate check after 10 seconds
        setTimeout(() => clearInterval(immediateCheck), 10000);
      }
    }

    return () => {
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      if (consoleErrorListener) {
        window.removeEventListener('message', consoleErrorListener);
      }
      if (errorCheckIntervalRef.current) {
        clearInterval(errorCheckIntervalRef.current);
      }
      if (iframe) {
        iframe.removeEventListener('load', loadHandler);
      }
    };
  }, [previewUrl]);

  const handleRequestFix = async () => {
    const errorText = errors.join('\n\n');
    
    // Check if this is a vite config error (Dynamic require of "path")
    const isConfigError = errors.some(error => 
      error.includes('failed to load config') ||
      error.includes('Dynamic require') ||
      error.includes('server restart failed')
    );
    
    if (isConfigError) {
      // Auto-fix vite.config.ts
      try {
        console.log('[Preview] Detected vite.config.ts error, fixing...');
        await WebContainerManager.fixPathAliasConfig();
        // Wait for Vite to reload
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Refresh the preview
        handleRefresh();
        setShowErrorPopup(false);
        return;
      } catch (fixError) {
        console.error('[Preview] Failed to auto-fix vite.config.ts:', fixError);
        // Fall through to show error
      }
    }
    
    // Check if this is a path alias error (Failed to resolve import with @/)
    const isPathAliasError = errors.some(error => 
      error.includes('Failed to resolve import') && 
      (error.includes('@/') || error.includes('@\\'))
    );
    
    if (isPathAliasError) {
      // Automatically fix path alias configuration
      try {
        console.log('[Preview] Detected path alias error, fixing configuration...');
        await WebContainerManager.fixPathAliasConfig();
        // Wait a moment for Vite to reload
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Refresh the preview
        handleRefresh();
        setShowErrorPopup(false);
        return;
      } catch (fixError) {
        console.error('[Preview] Failed to auto-fix path alias:', fixError);
        // Fall through to manual fix
      }
    }
    
    // Check if this is a missing dependencies error
    const missingDepsMatch = errorText.match(/The following dependencies are imported but could not be resolved:[\s\S]*?Are they installed\?/i);
    if (missingDepsMatch) {
      // Extract package names from the error
      // Pattern matches: "package-name (imported by /path/to/file.tsx)"
      // Also handles ANSI color codes that might be in the error
      const packageMatches = errorText.matchAll(/(?:\[36m)?([a-zA-Z0-9@/._-]+)(?:\[39m)?\s+\(imported by [^)]+\)/g);
      const missingPackages: string[] = [];
      
      for (const match of packageMatches) {
        const pkgName = match[1]?.trim();
        // Filter out ANSI codes and validate package name
        const cleanName = pkgName.replace(/\[[0-9;]+m/g, '').trim();
        if (cleanName && 
            cleanName.length > 0 && 
            !cleanName.includes('[') && 
            !cleanName.includes('m') &&
            !missingPackages.includes(cleanName)) {
          missingPackages.push(cleanName);
        }
      }
      
      // Fallback: try simpler pattern if first one didn't work
      if (missingPackages.length === 0) {
        const simpleMatches = errorText.matchAll(/([a-zA-Z0-9@/._-]+)\s+\(imported by [^)]+\)/g);
        for (const match of simpleMatches) {
          const pkgName = match[1]?.trim();
          if (pkgName && !missingPackages.includes(pkgName)) {
            missingPackages.push(pkgName);
          }
        }
      }
      
      if (missingPackages.length > 0) {
        // Auto-install missing packages
        try {
          console.log(`[Preview] Detected missing dependencies, installing: ${missingPackages.join(', ')}`);
          await WebContainerManager.installPackage(missingPackages);
          // Wait for Vite to re-optimize
          await new Promise(resolve => setTimeout(resolve, 3000));
          // Refresh the preview
          handleRefresh();
          setShowErrorPopup(false);
          return;
        } catch (installError) {
          console.error('[Preview] Failed to auto-install packages:', installError);
          // Fall through to manual fix with specific message
          const message = `The following npm packages are missing and need to be installed:\n\n${missingPackages.map(p => `- ${p}`).join('\n')}\n\nPlease install these packages using the install_package tool.`;
          if (onRequestFix) {
            onRequestFix(message);
          }
          setShowErrorPopup(false);
          return;
        }
      }
    }
    
    // For other errors or if auto-fix failed, request manual fix
    const message = `Please use your tools to examine the codebase and fix the following error(s):\n\n${errorText}`;
    
    if (onRequestFix) {
      onRequestFix(message);
    }
    
    setShowErrorPopup(false);
  };

  const handleRefresh = async () => {
    if (frameRef.current && previewUrl) {
      // Clear error states
      setErrors([]);
      setShowErrorPopup(false);
      hasErrorsRef.current = false;
      
      // Before refreshing, check and fix vite.config.ts if needed
      try {
        const viteConfig = await WebContainerManager.readFile("vite.config.ts").catch(() => null);
        if (viteConfig && (viteConfig.includes("import path") || viteConfig.includes("require('path')"))) {
          console.log('[Preview] Fixing vite.config.ts before refresh...');
          await WebContainerManager.fixPathAliasConfig();
          // Wait a moment for the fix to take effect
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (e) {
        // Ignore errors
      }
      
      // Try to reload via contentWindow first (more reliable)
      try {
        const iframeWindow = frameRef.current.contentWindow;
        if (iframeWindow && iframeWindow.location) {
          iframeWindow.location.reload();
          return;
        }
      } catch (e) {
        // Cross-origin or other error, fall back to src manipulation
      }
      
      // Fallback: Force reload by appending timestamp to URL
      // This ensures Vite re-resolves all modules and clears cached errors
      const url = new URL(previewUrl);
      url.searchParams.set('_refresh', Date.now().toString());
      frameRef.current.src = url.toString();
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Toolbar */}
      <div className="flex h-14 items-center justify-between border-b border-white/10 bg-background/95 backdrop-blur-sm px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-muted-foreground">
            <span>/</span>
            <span className="text-foreground">localhost:5173</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 rounded-lg text-xs"
            onClick={handleRefresh}
            title="Refresh preview"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
            <Github className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
            <ArrowUpRight className="h-4 w-4" />
          </Button>
          <Button size="sm" className="h-8 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground">
            Publish
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
            Login
          </Button>
          <Button variant="outline" size="sm" className="h-8 rounded-lg border-primary/30 bg-primary/10 text-xs text-primary">
            Register
          </Button>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="relative flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background">
            <div className="text-center space-y-3">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
              <p className="text-sm text-muted-foreground">Starting preview...</p>
            </div>
          </div>
        ) : previewUrl ? (
          <iframe
            ref={frameRef}
            onLoad={() => {
              if (frameRef.current) {
                registerIframe(frameRef.current);
              }
            }}
            src={previewUrl}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            title="Preview"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background">
            <div className="text-center space-y-4 px-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Preview will appear here</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  Start a chat session to generate code and see your app come to life. The preview will update automatically as changes are made.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Popup */}
        {showErrorPopup && errors.length > 0 && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-background/95 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Build Errors Detected</h3>
                    <p className="text-sm text-muted-foreground">Vite encountered errors while building</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowErrorPopup(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="max-h-96 overflow-y-auto px-6 py-4">
                <div className="space-y-3">
                  {errors.map((error, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-white/10 bg-white/5 p-4 font-mono text-sm text-foreground whitespace-pre-wrap"
                    >
                      {error}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10 px-6 py-4">
                <Button
                  onClick={handleRequestFix}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  size="md"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Ask AI to Fix
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="flex h-8 items-center justify-between border-t border-white/10 bg-background/95 px-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Preview</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Live
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-foreground transition-colors">Help Center</a>
          <a href="#" className="hover:text-foreground transition-colors">Join our Community</a>
        </div>
      </div>
    </div>
  );
}


