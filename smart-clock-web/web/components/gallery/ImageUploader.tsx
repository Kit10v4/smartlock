"use client";

import { useState } from "react";
import { uploadFile } from "@/lib/api";
import { sendImageFileToDevice } from "@/lib/imageTransfer";
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
    setPreviewUrl(URL.createObjectURL(current));
    await sendImageFileToDevice(current, onSendBinary, onSendCommand);
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
