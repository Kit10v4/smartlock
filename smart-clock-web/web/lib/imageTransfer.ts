import { parseGIF, decompressFrames } from "gifuct-js";
import { imageToRGB565, resizeImage } from "@/lib/imageUtils";

type SendBinary = (buffer: ArrayBuffer) => void;
type SendCommand = (payload: unknown) => void;

type ParsedGif = {
  lsd: { width: number; height: number };
};

export async function sendImageFileToDevice(file: File, sendBinary: SendBinary, sendCommand: SendCommand) {
  if (file.type === "image/gif") {
    const buffer = await file.arrayBuffer();
    const gif = parseGIF(buffer) as ParsedGif;
    const frames = decompressFrames(gif, true);
    sendCommand({
      type: "gif_start",
      frames: frames.length,
      width: gif.lsd.width,
      height: gif.lsd.height,
      delay: frames[0]?.delay || 100
    });
    for (const frame of frames) {
      const canvas = document.createElement("canvas");
      canvas.width = gif.lsd.width;
      canvas.height = gif.lsd.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas context is unavailable");
      }
      const imageData = new ImageData(
        new Uint8ClampedArray(frame.patch),
        frame.dims.width,
        frame.dims.height
      );
      ctx.putImageData(imageData, frame.dims.left, frame.dims.top);
      const fullData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      sendBinary(imageToRGB565(fullData.data, canvas.width, canvas.height));
      await new Promise((resolve) => setTimeout(resolve, frame.delay || 100));
    }
    sendCommand({ type: "gif_end" });
    return;
  }

  const result = await resizeImage(file);
  sendBinary(result.rgb565);
}

