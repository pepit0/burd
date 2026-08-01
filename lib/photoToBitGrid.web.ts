import { COLONY_BIT_GRID, bitPixelsFromRgba, type BitPixel } from "@/lib/colonyBitArt";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

/** Sample a species photo into a retro pixel grid (web canvas). */
export async function photoToBitGrid(imageUrl: string): Promise<BitPixel[] | null> {
  try {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = COLONY_BIT_GRID;
    canvas.height = COLONY_BIT_GRID;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, COLONY_BIT_GRID, COLONY_BIT_GRID);

    const { data } = ctx.getImageData(0, 0, COLONY_BIT_GRID, COLONY_BIT_GRID);
    return bitPixelsFromRgba(COLONY_BIT_GRID, COLONY_BIT_GRID, data);
  } catch {
    return null;
  }
}
