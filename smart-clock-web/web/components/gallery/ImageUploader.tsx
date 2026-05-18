"use client";

import { useEffect, useState } from "react";
import { uploadFile } from "@/lib/api";
import { sendImageFileToDevice } from "@/lib/imageTransfer";
import ImagePreview from "./ImagePreview";

type Props = {
  onUploaded: () => void;
  onSendJson: (payload: unknown) => void;
  onSendBinary: (buffer: ArrayBuffer) => void;
};

export default function ImageUploader({ onUploaded, onSendJson, onSendBinary }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function prepare(current: File) {
    setMessage("Processing image for ESP32...");
    setIsSending(true);
    const nextPreviewUrl = URL.createObjectURL(current);
    setPreviewUrl(nextPreviewUrl);

    try {
      await sendImageFileToDevice(current, onSendJson, onSendBinary);
      setMessage("Sent RGB565 image (chunked) to ESP32");
    } finally {
      setIsSending(false);
    }
  }

  async function upload() {
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadFile("/api/gallery/upload", file);
      setMessage(`Uploaded ${file.name}`);
      setFile(null);
      onUploaded();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Upload failed";
      setMessage(text);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="row">
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.gif,image/*"
            disabled={isSending || isUploading}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (!selected) return;
              setFile(selected);
              prepare(selected).catch((err: Error) => setMessage(err.message));
            }}
          />
          <button className="primary" onClick={upload} disabled={!file || isSending || isUploading}>
            {isUploading ? "Uploading..." : "Upload"}
          </button>
        </div>
        {message && <div className="muted">{message}</div>}
        <div className="muted">ESP32 mode: chunked RGB565, max 320x218</div>
      </div>
      <ImagePreview src={previewUrl} />
    </div>
  );
}
