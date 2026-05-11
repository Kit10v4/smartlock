"use client";

import { useState } from "react";
import jsmediatags from "jsmediatags";
import { uploadFile } from "@/lib/api";

type Props = {
  onDone: () => void;
};

type TagResult = {
  title: string;
  artist: string;
};

function readTags(file: File): Promise<TagResult> {
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: (result: { tags: { title?: string; artist?: string } }) =>
        resolve({
          title: result.tags.title || file.name.replace(/\.mp3$/i, ""),
          artist: result.tags.artist || "Unknown"
        }),
      onError: () =>
        resolve({
          title: file.name.replace(/\.mp3$/i, ""),
          artist: "Unknown"
        })
    });
  });
}

export default function MP3Uploader({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  async function onSelectFile(file: File) {
    setMessage("");
    setProgress(20);
    const tags = await readTags(file);
    setProgress(50);
    await uploadFile("/api/upload/mp3", file, {
      title: tags.title,
      artist: tags.artist
    });
    setProgress(100);
    setMessage(`Uploaded: ${tags.title}`);
    onDone();
  }

  return (
    <div className="card">
      <div className="row">
        <input
          type="file"
          accept=".mp3,audio/mpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSelectFile(file);
          }}
        />
        <span className="muted">{progress > 0 ? `${progress}%` : "No upload"}</span>
      </div>
      {message && <div className="muted">{message}</div>}
    </div>
  );
}
