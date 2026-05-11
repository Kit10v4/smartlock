"use client";

import type { GalleryItem } from "@/lib/types";

type Props = {
  items: GalleryItem[];
  onSend: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function GalleryGrid({ items, onSend, onDelete }: Props) {
  return (
    <div className="grid grid-2">
      {items.map((item) => (
        <div key={item.id} className="card">
          <img src={item.url} alt={item.name} style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />
          <strong>{item.name}</strong>
          <div className="muted">{item.type}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={() => onSend(item.id)}>Send</button>
            <button className="danger" onClick={() => onDelete(item.id)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
