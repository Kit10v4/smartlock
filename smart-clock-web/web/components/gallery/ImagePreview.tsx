"use client";

type Props = {
  src: string;
};

export default function ImagePreview({ src }: Props) {
  if (!src) {
    return null;
  }
  return (
    <div className="card">
      <div className="muted">Preview</div>
      <img src={src} alt="preview" style={{ width: "100%", maxWidth: 420, borderRadius: 8 }} />
    </div>
  );
}
