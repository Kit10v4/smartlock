const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");

module.exports = function galleryRoutes({ store, sendToDevice }, uploadsDir) {
  const router = express.Router();

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      cb(null, `${Date.now()}-${randomUUID()}${ext}`);
    }
  });
  const upload = multer({ storage });

  router.get("/", (_req, res) => {
    res.json(store.get("gallery", []));
  });

  router.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "file is required" });
      return;
    }
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const item = {
      id: randomUUID(),
      name: req.body.name || req.file.originalname,
      type: req.file.mimetype,
      url: `${baseUrl}/uploads/${req.file.filename}`,
      filename: req.file.filename,
      createdAt: new Date().toISOString()
    };
    store.push("gallery", item);
    res.status(201).json(item);
  });

  router.post("/:id/send", async (req, res) => {
    const item = store.get("gallery", []).find((entry) => entry.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: "item not found" });
      return;
    }

    if (!item.filename) {
      res.status(404).json({ error: "image file not found" });
      return;
    }

    const filePath = path.join(uploadsDir, item.filename);
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch (_error) {
      res.status(404).json({ error: "image file not found" });
      return;
    }

    let data;
    let info;
    try {
      ({ data, info } = await sharp(filePath, { animated: false })
        .resize({ width: 320, height: 240, fit: "inside", withoutEnlargement: true })
        .toColorspace("srgb")
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }));
    } catch (error) {
      res.status(500).json({ error: error.message || "failed to process image" });
      return;
    }

    const width = info.width || 0;
    const height = info.height || 0;
    const channels = info.channels || 0;
    if (width <= 0 || height <= 0 || channels < 3) {
      res.status(500).json({ error: "invalid image data" });
      return;
    }

    const pixelCount = width * height;
    const payload = Buffer.allocUnsafe(4 + (pixelCount * 2));
    payload.writeUInt16BE(width, 0);
    payload.writeUInt16BE(height, 2);

    for (let i = 0; i < pixelCount; i += 1) {
      const offset = i * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const rgb565 = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
      payload.writeUInt16BE(rgb565, 4 + (i * 2));
    }

    const sent = sendToDevice(payload, true);
    if (!sent) {
      res.status(503).json({ error: "ESP32 is offline" });
      return;
    }
    res.json({ ok: true, width, height });
  });

  router.delete("/:id", (req, res) => {
    const items = store.get("gallery", []);
    const target = items.find((item) => item.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: "item not found" });
      return;
    }
    store.set(
      "gallery",
      items.filter((item) => item.id !== req.params.id)
    );
    if (target.filename) {
      const filePath = path.join(uploadsDir, target.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.status(204).send();
  });

  return router;
};
