/**
 * Client-side WebP conversion for admin photo uploads.
 *
 * The app deploys to Cloudflare Workers, where native encoders (sharp) can't
 * run, so the owner's browser does the encoding via canvas and we upload the
 * already-WebP bytes. The longest edge is capped (retina-friendly) and never
 * upscaled; quality trades size against fidelity for product photos.
 *
 * Browser support: Chrome/Edge/Firefox encode WebP from canvas; very old
 * Safari returns PNG instead, which we detect and reject with a clear message.
 */

const MAX_DIMENSION = 2000;
const QUALITY = 0.82;

export interface WebpResult {
  blob: Blob;
  width: number;
  height: number;
}

export class WebpUnsupportedError extends Error {
  constructor() {
    super(
      "This browser can't create WebP images. Please use Chrome, Edge, or Firefox.",
    );
    this.name = "WebpUnsupportedError";
  }
}

function targetSize(width: number, height: number): { w: number; h: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_DIMENSION) return { w: width, h: height };
  const scale = MAX_DIMENSION / longest;
  return { w: Math.round(width * scale), h: Math.round(height * scale) };
}

async function encode(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/webp", quality: QUALITY });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/webp",
      QUALITY,
    );
  });
}

/**
 * Decode `file`, resize to fit MAX_DIMENSION, and re-encode as WebP. Throws
 * WebpUnsupportedError if the browser can't produce WebP output.
 */
export async function convertToWebp(file: File): Promise<WebpResult> {
  const bitmap = await createImageBitmap(file);
  const { w, h } = targetSize(bitmap.width, bitmap.height);

  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(w, h);
  } else {
    canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Could not get a 2D canvas context.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await encode(canvas);
  if (blob.type !== "image/webp") throw new WebpUnsupportedError();

  return { blob, width: w, height: h };
}
