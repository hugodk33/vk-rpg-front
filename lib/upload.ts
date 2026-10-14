"use client";

/* ============================================================
   upload — turn a picked <input type="file"> into a compact
   base64 data URL ready for POST /upload. Raster images are
   downscaled AND re-encoded in the browser until they fit the
   upload budget (1.5 MB), so a 5 MB phone photo never hits the
   API oversized; SVGs pass through untouched.
   ============================================================ */

/** Hard ceiling for a stored image, mirrored by the API. */
export const MAX_UPLOAD_BYTES = Math.round(1.5 * 1024 * 1024);

/** Number of bytes a `data:...;base64,` url decodes to. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem inválida."));
    img.src = src;
  });
}

/**
 * Shrink + re-encode a base64 image so it fits `maxBytes` and its longest
 * side fits `maxDim`, keeping the data-url form. Strategy: downscale once to
 * `maxDim`, then progressively lower the JPEG quality; if still too big, scale
 * the canvas down and repeat. SVGs are returned untouched.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxDim = 1600,
  maxBytes = MAX_UPLOAD_BYTES
): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  if (dataUrl.startsWith("data:image/svg")) return dataUrl;

  const img = await loadImage(dataUrl);
  const longest = Math.max(img.width, img.height) || 1;
  const isPng = dataUrl.startsWith("data:image/png");
  let scale = Math.min(1, maxDim / longest);
  let best = dataUrl;

  for (let attempt = 0; attempt < 8; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return best;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // PNG keeps lossless transparency, but has no quality knob: if it still
    // blows the budget, fall back to JPEG.
    let encoded = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.92);
    if (isPng && dataUrlBytes(encoded) > maxBytes) {
      encoded = canvas.toDataURL("image/jpeg", 0.9);
    }

    let quality = 0.9;
    while (dataUrlBytes(encoded) > maxBytes && quality > 0.4) {
      quality = Math.max(0.4, quality - 0.12);
      encoded = canvas.toDataURL("image/jpeg", quality);
    }

    best = encoded;
    if (dataUrlBytes(encoded) <= maxBytes) return encoded;
    scale *= 0.8;
  }

  return best;
}

/** Back-compat alias: downscale to a max dimension (no byte budget). */
export async function downscaleDataUrl(dataUrl: string, maxDim = 1600): Promise<string> {
  return compressDataUrl(dataUrl, maxDim, Number.MAX_SAFE_INTEGER);
}

/** File -> ready-to-upload data URL (read + compress to <=1.5 MB). */
export async function prepareUpload(file: File, maxDim = 1600): Promise<string> {
  const raw = await fileToDataUrl(file);
  try {
    return await compressDataUrl(raw, maxDim);
  } catch {
    return raw;
  }
}
