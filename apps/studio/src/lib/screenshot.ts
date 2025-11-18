"use client";

/**
 * Capture a screenshot of an iframe using the ScreenCapture API (Chrome only for now)
 * Falls back to a simple message if not supported
 */
export async function captureIframeScreenshot(
  iframe: HTMLIFrameElement
): Promise<string | null> {
  try {
    // For WebContainer iframes, we can't directly access the content due to cross-origin restrictions
    // Instead, we'll use a workaround: capture the entire viewport and crop to the iframe

    if (!iframe.src) {
      console.warn("No iframe src to capture");
      return null;
    }

    // Check if we have the experimental getDisplayMedia API
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      console.log("Note: Screenshot requires user permission. Displaying current preview URL instead.");
      // We can't automatically capture without user permission
      // For now, return null and let the AI know the current state via text
      return null;
    }

    // Fallback: Just tell the AI what's currently displayed
    console.log("Screenshot not available, using text description instead");
    return null;
  } catch (error) {
    console.error("Failed to capture screenshot:", error);
    return null;
  }
}

/**
 * Simple screenshot using html2canvas library
 * This should be used if html2canvas is installed
 */
export async function captureWithHtml2Canvas(
  element: HTMLElement
): Promise<string | null> {
  try {
    // @ts-ignore - html2canvas might not be in types
    if (typeof window.html2canvas === "undefined") {
      throw new Error("html2canvas is not loaded");
    }

    // @ts-ignore
    const canvas = await window.html2canvas(element);
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
