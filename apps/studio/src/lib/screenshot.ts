"use client";

import html2canvas from "html2canvas";

type Nullable<T> = T | null;

const SVG_XMLNS = "http://www.w3.org/2000/svg";

/**
 * Global registry for iframe references
 * This allows screenshot capture to work even when called from different contexts
 */
let globalIframeRef: HTMLIFrameElement | null = null;

export function registerIframe(iframe: HTMLIFrameElement | null): void {
  globalIframeRef = iframe;
}

export function getGlobalIframe(): HTMLIFrameElement | null {
  return globalIframeRef;
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load serialized iframe"));
    img.src = url;
  });
}

/**
 * Check if iframe is same-origin (can access content)
 */
function isSameOrigin(iframe: HTMLIFrameElement): boolean {
  try {
    // First check the src attribute - blob: and data: URLs are always same-origin
    const src = iframe.src;
    if (src.startsWith('blob:') || src.startsWith('data:') || !src) {
      // Blob URLs and data URLs are same-origin
      // Empty src means it's about:blank which is same-origin
      return true;
    }

    // Try to access contentWindow - will throw if cross-origin
    const win = iframe.contentWindow;
    if (!win) return false;
    
    // Try to access location - will throw if cross-origin
    try {
      const href = win.location.href;
      // If we can read location, it's same-origin (or we got lucky)
      // Double-check by comparing origins if possible
      try {
        const iframeUrl = new URL(href);
        const currentUrl = new URL(window.location.href);
        // Same origin means same protocol, host, and port
        return iframeUrl.origin === currentUrl.origin;
      } catch (e) {
        // If URL parsing fails, but we can read location, assume same-origin
        // This handles blob: and data: URLs
        return true;
      }
    } catch (e) {
      // Can't access location = cross-origin
      return false;
    }
  } catch (e) {
    // Any error accessing iframe = likely cross-origin
    return false;
  }
}

/**
 * Attempt to capture the contents of a same-origin iframe by serializing its DOM tree into an SVG.
 * Returns null if the iframe is cross-origin or cannot be read.
 */
async function captureSameOriginIframe(
  iframe: HTMLIFrameElement
): Promise<Nullable<string>> {
  try {
    // First check if it's actually same-origin
    if (!isSameOrigin(iframe)) {
      console.debug("Iframe is cross-origin, cannot access content directly");
      return null;
    }

    // Wait a bit for any pending renders
    await new Promise(resolve => setTimeout(resolve, 200));

    let iframeDoc: Document | null = null;
    try {
      iframeDoc = iframe.contentDocument || iframe.contentWindow?.document || null;
    } catch (e) {
      // Cross-origin error
      console.debug("Cannot access iframe document (cross-origin)", e);
      return null;
    }

    if (!iframeDoc) {
      return null;
    }

    // Check if document is ready
    if (iframeDoc.readyState === 'loading') {
      // Wait for document to load
      await new Promise<void>((resolve) => {
        if (iframeDoc.readyState === 'complete') {
          resolve();
          return;
        }
        const checkReady = () => {
          if (iframeDoc.readyState === 'complete' || iframeDoc.readyState === 'interactive') {
            resolve();
          } else {
            setTimeout(checkReady, 50);
          }
        };
        iframeDoc.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
        setTimeout(() => resolve(), 2000); // Timeout after 2 seconds
      });
    }

    const rect = iframe.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width === 0 || height === 0) {
      return null;
    }

    // Check if body exists and has content
    if (!iframeDoc.body || iframeDoc.body.children.length === 0) {
      // Wait a bit more for content to load
      await new Promise(resolve => setTimeout(resolve, 200));
      if (!iframeDoc.body || iframeDoc.body.children.length === 0) {
        return null;
      }
    }

    const serialized = new XMLSerializer().serializeToString(
      iframeDoc.documentElement
    );
    
    // Check if serialized content is meaningful
    if (!serialized || serialized.length < 100) {
      return null;
    }

    const svg = `
      <svg xmlns="${SVG_XMLNS}" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          ${serialized}
        </foreignObject>
      </svg>
    `.trim();

    const blob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    try {
      const image = await loadImageFromUrl(url);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      ctx.drawImage(image, 0, 0);
      return canvas.toDataURL("image/png").split(",")[1];
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.warn("Same-origin iframe capture failed", error);
    return null;
  }
}

async function grabStreamFrame(
  stream: MediaStream,
  element: HTMLElement
): Promise<Nullable<string>> {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.style.position = "fixed";
  video.style.left = "-9999px";

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Unable to read captured video"));
  });

  await video.play();

  const track = stream.getVideoTracks()[0];
  const settings = track?.getSettings();
  const videoWidth = video.videoWidth || settings?.width || window.innerWidth;
  const videoHeight = video.videoHeight || settings?.height || window.innerHeight;

  if (!videoWidth || !videoHeight) {
    return null;
  }

  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = videoWidth;
  frameCanvas.height = videoHeight;
  const frameCtx = frameCanvas.getContext("2d");
  if (!frameCtx) {
    return null;
  }
  frameCtx.drawImage(video, 0, 0, videoWidth, videoHeight);

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  const dpr = window.devicePixelRatio || 1;
  const cropWidth = Math.min(videoWidth, Math.max(1, Math.round(rect.width * dpr)));
  const cropHeight = Math.min(videoHeight, Math.max(1, Math.round(rect.height * dpr)));
  let cropX = Math.round(rect.left * dpr);
  let cropY = Math.round(rect.top * dpr);
  cropX = Math.min(Math.max(0, cropX), Math.max(0, videoWidth - cropWidth));
  cropY = Math.min(Math.max(0, cropY), Math.max(0, videoHeight - cropHeight));

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cropWidth;
  cropCanvas.height = cropHeight;
  const cropCtx = cropCanvas.getContext("2d");
  if (!cropCtx) {
    return null;
  }

  cropCtx.drawImage(
    frameCanvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );

  const dataUrl = cropCanvas.toDataURL("image/png");
  video.pause();
  video.srcObject = null;

  return dataUrl.split(",")[1];
}

async function captureViaDisplayMedia(
  element: HTMLElement
): Promise<Nullable<string>> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    console.warn("Screen capture API not supported in this browser");
    return null;
  }

  let stream: MediaStream | null = null;
  try {
    const constraints: DisplayMediaStreamOptions = {
      audio: false,
      video: {
        frameRate: 30,
        width: window.screen.width * (window.devicePixelRatio || 1),
        height: window.screen.height * (window.devicePixelRatio || 1),
        // @ts-expect-error - not yet in the TS lib but supported in Chromium
        preferCurrentTab: true,
        // @ts-expect-error - Chromium specific constraint
        displaySurface: "browser",
      },
    };

    stream = await navigator.mediaDevices.getDisplayMedia(constraints);
  } catch (error) {
    console.warn("User dismissed screen capture prompt", error);
    return null;
  }

  if (!stream) {
    return null;
  }

  try {
    return await grabStreamFrame(stream, element);
  } catch (error) {
    console.error("Failed to capture screen share frame", error);
    return null;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

/**
 * Wait for iframe to be ready and loaded
 * More lenient checks - iframe is considered ready if it has dimensions and a source
 */
async function waitForIframeReady(iframe: HTMLIFrameElement, timeout: number = 3000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      // Basic checks: iframe must have dimensions and a source
      const rect = iframe.getBoundingClientRect();
      const hasDimensions = rect.width > 0 && rect.height > 0;
      const hasSource = iframe.src && iframe.src.length > 0;
      
      if (!hasDimensions || !hasSource) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Try to check document state (may fail for cross-origin)
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          // Document exists - check if it's loaded
          if (doc.readyState === 'complete' || doc.readyState === 'interactive') {
            // If we can access the document and it's loaded, we're good
            return true;
          }
          // If document exists but not complete, wait a bit more
          if (doc.readyState === 'loading') {
            await new Promise(resolve => setTimeout(resolve, 200));
            continue;
          }
        }
      } catch (e) {
        // Cross-origin - can't access document, but iframe has dimensions and source
        // Consider it ready if it's been visible for a bit
        if (Date.now() - startTime > 500) {
          return true; // Give it a moment, then consider ready
        }
      }

      // If we have dimensions and source, and some time has passed, consider ready
      if (hasDimensions && hasSource && Date.now() - startTime > 1000) {
        return true;
      }
    } catch (e) {
      // Any error - continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // If we have dimensions and source after timeout, consider it ready anyway
  try {
    const rect = iframe.getBoundingClientRect();
    const hasDimensions = rect.width > 0 && rect.height > 0;
    const hasSource = iframe.src && iframe.src.length > 0;
    if (hasDimensions && hasSource) {
      return true;
    }
  } catch (e) {
    // Ignore errors
  }
  
  return false;
}

/**
 * Capture screenshot using html2canvas on the iframe element itself
 * This works for cross-origin iframes by capturing the visual representation
 */
async function captureIframeVisual(iframe: HTMLIFrameElement): Promise<Nullable<string>> {
  try {
    const rect = iframe.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    
    if (width === 0 || height === 0) {
      return null;
    }

    // Use html2canvas to capture the iframe element
    // html2canvas can capture cross-origin iframes by rendering them visually
    try {
      const canvas = await html2canvas(iframe, {
        useCORS: true, // Try to use CORS if available
        allowTaint: true, // Allow tainted canvas (needed for cross-origin)
        logging: false,
        width: width,
        height: height,
        scale: 1,
        backgroundColor: '#ffffff',
        removeContainer: false,
        // Important: foreignObjectRendering helps with iframes
        foreignObjectRendering: true,
      });
      
      return canvas.toDataURL("image/png").split(",")[1];
    } catch (e) {
      console.debug("html2canvas capture failed", e);
      return null;
    }
  } catch (error) {
    console.debug("Visual capture failed", error);
    return null;
  }
}

/**
 * Capture a screenshot of an iframe. Attempts multiple methods:
 * 1. Same-origin DOM access (most reliable, but only works for same-origin)
 * 2. html2canvas visual capture (works for cross-origin, but content may be limited)
 * 3. Display media API (requires user interaction)
 */
export async function captureIframeScreenshot(
  iframe: HTMLIFrameElement
): Promise<Nullable<string>> {
  // First, wait for iframe to be ready (with a reasonable timeout)
  const isReady = await waitForIframeReady(iframe, 3000);
  if (!isReady) {
    // Check if iframe at least has basic requirements
    const rect = iframe.getBoundingClientRect();
    const hasDimensions = rect.width > 0 && rect.height > 0;
    const hasSource = iframe.src && iframe.src.length > 0;
    
    if (!hasDimensions || !hasSource) {
      console.warn("Iframe missing basic requirements (dimensions or source), attempting capture anyway...");
    } else {
      // Iframe has dimensions and source, it's probably ready even if checks failed
      console.debug("Iframe readiness checks inconclusive, but iframe appears ready");
    }
  }

  // Try same-origin capture first (most reliable and highest quality)
  const sameOrigin = await captureSameOriginIframe(iframe);
  if (sameOrigin) {
    return sameOrigin;
  }

  // If same-origin failed (cross-origin), try html2canvas visual capture
  // This captures the iframe element visually, but cross-origin content may be blank
  // However, it's better than nothing and doesn't require user interaction
  console.debug("Same-origin capture failed, trying html2canvas visual capture...");
  const visualCapture = await captureIframeVisual(iframe);
  if (visualCapture) {
    return visualCapture;
  }

  // Last resort: display media API (requires user interaction)
  // This will prompt the user to share their screen/window
  // Note: This is not ideal for automatic screenshots, but it's the only way
  // to capture cross-origin iframe content reliably
  console.warn("html2canvas failed, falling back to display media API (requires user permission)");
  return captureViaDisplayMedia(iframe);
}

/**
 * Simple screenshot using html2canvas library
 * This should be used if html2canvas is installed
 */
export async function captureWithHtml2Canvas(
  element: HTMLElement
): Promise<string | null> {
  try {
    const canvas = await html2canvas(element, {
      useCORS: true,
      allowTaint: true,
      logging: false,
    });
    const dataUrl = canvas.toDataURL("image/png");
    return dataUrl.split(",")[1]; // Return base64 without prefix
  } catch (error) {
    console.error("Failed to capture with html2canvas:", error);
    return null;
  }
}

/**
 * Capture screenshot by loading the URL in a hidden iframe
 */
export async function captureUrlScreenshot(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.width = "1280px";
    iframe.style.height = "720px";

    iframe.onload = async () => {
      // Wait a bit for the page to render
      await new Promise((r) => setTimeout(r, 1000));

      const screenshot = await captureIframeScreenshot(iframe);
      document.body.removeChild(iframe);
      resolve(screenshot);
    };

    iframe.onerror = () => {
      document.body.removeChild(iframe);
      resolve(null);
    };

    document.body.appendChild(iframe);
    iframe.src = url;
  });
}
