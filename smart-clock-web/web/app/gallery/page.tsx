"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import type { GalleryItem } from "@/lib/types";
import { sendImageFileToDevice } from "@/lib/imageTransfer";
import ImageUploader from "@/components/gallery/ImageUploader";
import GalleryGrid from "@/components/gallery/GalleryGrid";

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [message, setMessage] = useState("");
  const { send, sendBinary } = useSocket();

  async function load() {
    const data = (await api.getGallery()) as GalleryItem[];
    setItems(data);
  }

  useEffect(() => {
    load().catch((e: Error) => setMessage(e.message));
  }, []);

  async function sendGalleryItem(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (!item) {
      setMessage("Image not found in gallery");
      return;
    }
    const response = await fetch(item.url);
    if (!response.ok) {
      throw new Error(`Failed to load image: ${response.status}`);
    }
    const blob = await response.blob();
    const file = new File([blob], item.name || `gallery-${id}`, { type: blob.type || item.type });
    await sendImageFileToDevice(file, sendBinary, send);
  }

  return (
    <main className="container">
      <h1 className="title">Gallery</h1>
      <ImageUploader onUploaded={() => load().catch(() => null)} onSendBinary={sendBinary} onSendCommand={send} />
      {message && <div style={{ color: "var(--error)" }}>{message}</div>}
      <div style={{ marginTop: 12 }}>
        <GalleryGrid
          items={items}
          onSend={(id) => api.sendGallery(id).catch((e: Error) => setMessage(e.message))}
          onDelete={(id) =>
            api
              .deleteGallery(id)
              .then(() => load())
              .catch((e: Error) => setMessage(e.message))
          }
        />
      </div>
    </main>
  );
}
