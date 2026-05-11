export function imageToRGB565(imageData: Uint8ClampedArray, width: number, height: number) {
  const buffer = new ArrayBuffer(4 + width * height * 2);
  const view = new DataView(buffer);
  view.setUint16(0, width);
  view.setUint16(2, height);

  let offset = 4;
  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const rgb565 = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
    view.setUint16(offset, rgb565);
    offset += 2;
  }
  return buffer;
}

export async function resizeImage(file: File, maxWidth = 320, maxHeight = 240) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Cannot load image"));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  let w = img.width;
  let h = img.height;

  if (w > maxWidth) {
    h = (h * maxWidth) / w;
    w = maxWidth;
  }
  if (h > maxHeight) {
    w = (w * maxHeight) / h;
    h = maxHeight;
  }

  canvas.width = Math.floor(w);
  canvas.height = Math.floor(h);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context is unavailable");
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  URL.revokeObjectURL(url);
  return {
    width: canvas.width,
    height: canvas.height,
    rgb565: imageToRGB565(imageData, canvas.width, canvas.height),
    previewUrl: canvas.toDataURL("image/png")
  };
}
