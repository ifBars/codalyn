"use client";

/**
 * Capture a screenshot of an iframe
 */
export async function captureIframeScreenshot(
  iframe: HTMLIFrameElement
): Promise<string | null> {
  try {
    // Create a canvas element
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    // Set canvas size to match iframe
    const rect = iframe.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Try to capture the iframe content
    // Note: This requires the iframe to be same-origin or have CORS enabled
    try {
      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow?.document;

      if (!iframeDoc) {
        throw new Error("Cannot access iframe document");
      }

      // Use html2canvas or similar library if available
      // For now, we'll use a simpler approach with foreignObject
      const data = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">
              ${iframeDoc.documentElement.outerHTML}
            </div>
          </foreignObject>
        </svg>
      `;

      const blob = new Blob([data], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");
          URL.revokeObjectURL(url);
          // Return base64 without the data:image/png;base64, prefix
          resolve(dataUrl.split(",")[1]);
        };
        img.onerror = reject;
        img.src = url;
      });
    } catch (e) {
      // Fallback: use screenshot API if available (Chrome only)
      console.warn("Cannot access iframe content, trying fallback method");

      // For WebContainers, we might need to use a different approach
      // Since the iframe is same-origin (WebContainer serves on same domain)
      // we should be able to access it

      // Alternative: Use a library like html2canvas
      throw new Error(
        "Screenshot capture requires same-origin iframe or CORS headers"
      );
    }
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
