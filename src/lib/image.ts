/** Read an image file into a small JPEG data URL (max 256px) for local storage. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 256;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image"));
    };
    img.src = url;
  });
}

/** Avatar: reject over 2 MB, resize to max 128x128 and keep under ~50 KB. */
export async function avatarDataUrl(file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error("Choose an image under 2 MB");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Couldn't read that image")); i.src = url; });
    const size = Math.min(128, img.width, img.height);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const s = Math.min(img.width, img.height);
    c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    for (let q = 0.85; q >= 0.3; q -= 0.1) {
      const out = c.toDataURL("image/jpeg", q);
      if (out.length * 0.75 <= 50 * 1024) return out;
    }
    throw new Error("That image is too detailed — try another");
  } finally { URL.revokeObjectURL(url); }
}
