"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import type { GalleryItem } from "@/lib/types";
import ImageUploader from "@/components/gallery/ImageUploader";
import GalleryGrid from "@/components/gallery/GalleryGrid";

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [message, setMessage] = useState("");
  const { sendBinary } = useSocket();

  async function load() {
    const data = (await api.getGallery()) as GalleryItem[];
    setItems(data);
  }

  useEffect(() => {
    load().catch((e: Error) => setMessage(e.message));
  }, []);

  return (
    <main className="container">
      <h1 className="title">Gallery</h1>
      <ImageUploader onUploaded={() => load().catch(() => null)} onSendBinary={sendBinary} />
      {message && <div style={{ color: "var(--error)" }}>{message}</div>}
      <div style={{ marginTop: 12 }}>
        <GalleryGrid
          items={items}
          onSend={(id) =>
            api
              .sendGallery(id)
              .then((result) => {
                const payload = result as {
                  width?: number;
                  height?: number;
                  packetBytes?: number;
                  packetLimitBytes?: number;
                };
                setMessage(
                  `Sent to ESP32: ${payload.width ?? "?"}x${payload.height ?? "?"}, ${payload.packetBytes ?? "?"} bytes (limit ${payload.packetLimitBytes ?? "?"})`
                );
              })
              .catch((e: Error) => setMessage(e.message))
          }
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