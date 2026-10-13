"use client";

/* ============================================================
   upload — turn a picked <input type="file"> into a compact
   base64 data URL ready for POST /upload. Raster images are
   downscaled in the browser so a 5 MB phone photo doesn't hit
   the API as a 7 MB JSON body; SVGs pass through untouched.
   ============================================================ */

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

/** Shrink a base64 image so its longest side fits `maxDim` (keeps data URLs). */
export async function downscaleDataUrl(dataUrl: string, maxDim = 1600): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  if (dataUrl.startsWith("data:image/svg")) return dataUrl;
  const img = await loadImage(dataUrl);
  const longest = Math.max(img.width, img.height) || 1;
  const scale = Math.min(1, maxDim / longest);
  if (scale >= 1) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const isPng = dataUrl.startsWith("data:image/png");
  return canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.9);
}

/** File -> ready-to-upload data URL (read + downscale). */
export async function prepareUpload(file: File, maxDim = 1600): Promise<string> {
  const raw = await fileToDataUrl(file);
  try {
    return await downscaleDataUrl(raw, maxDim);
  } catch {
    return raw;
  }
}
