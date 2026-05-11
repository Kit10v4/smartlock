"use client";

import { useState } from "react";
import { parseGIF, decompressFrames } from "gifuct-js";
import { uploadFile } from "@/lib/api";
import { imageToRGB565, resizeImage } from "@/lib/imageUtils";
import ImagePreview from "./ImagePreview";

type Props = {
  onUploaded: () => void;
  onSendBinary: (buffer: ArrayBuffer) => void;
  onSendCommand: (payload: unknown) => void;
};

export default function ImageUploader({ onUploaded, onSendBinary, onSendCommand }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [message, setMessage] = useState("");

  async function prepare(current: File) {
    if (current.type === "image/gif") {
      const url = URL.createObjectURL(current);
      setPreviewUrl(url);
      const buffer = await current.arrayBuffer();
      const gif = parseGIF(buffer) as { lsd: { width: number; height: number } };
      const frames = decompressFrames(gif, true);
      onSendCommand({
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
        if (!ctx) break;
        const imageData = new ImageData(
          new Uint8ClampedArray(frame.patch),
          frame.dims.width,
          frame.dims.height
        );
        ctx.putImageData(imageData, frame.dims.left, frame.dims.top);
        const fullData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        onSendBinary(imageToRGB565(fullData.data, canvas.width, canvas.height));
        await new Promise((resolve) => setTimeout(resolve, frame.delay || 100));
      }
      onSendCommand({ type: "gif_end" });
      return;
    }

    const result = await resizeImage(current);
    setPreviewUrl(result.previewUrl);
    onSendBinary(result.rgb565);
  }

  async function upload() {
    if (!file) return;
    await uploadFile("/api/gallery/upload", file);
    setMessage(`Uploaded ${file.name}`);
    setFile(null);
    onUploaded();
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="row">
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.gif,image/*"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (!selected) return;
              setFile(selected);
              prepare(selected).catch((err: Error) => setMessage(err.message));
            }}
          />
          <button className="primary" onClick={upload} disabled={!file}>
            Upload
          </button>
        </div>
        {message && <div className="muted">{message}</div>}
      </div>
      <ImagePreview src={previewUrl} />
    </div>
  );
}
