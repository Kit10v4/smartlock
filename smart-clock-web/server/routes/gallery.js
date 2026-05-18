const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");

const { sendImageChunkedToDevice } = require("../services/imageSender");

const DEFAULT_MAX_WIDTH = 320;
const DEFAULT_MAX_HEIGHT = 218;

function readPositiveInt(value, fallback, minimum = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const intVal = Math.floor(parsed);
  if (intVal < minimum) return fallback;
  return intVal;
}

const ESP32_MAX_WIDTH = readPositiveInt(process.env.ESP32_IMAGE_MAX_WIDTH, DEFAULT_MAX_WIDTH);
const ESP32_MAX_HEIGHT = readPositiveInt(process.env.ESP32_IMAGE_MAX_HEIGHT, DEFAULT_MAX_HEIGHT);

function computeTargetSize(width, height) {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const ratio = Math.min(1, ESP32_MAX_WIDTH / width, ESP32_MAX_HEIGHT / height);
  return {
    width: Math.max(1, Math.floor(width * ratio)),
    height: Math.max(1, Math.floor(height * ratio))
  };
}

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

    let metadata;
    try {
      metadata = await sharp(filePath, { animated: false }).metadata();
    } catch (error) {
      res.status(500).json({ error: error.message || "failed to read image metadata" });
      return;
    }

    const srcWidth = metadata.width || 0;
    const srcHeight = metadata.height || 0;
    const targetSize = computeTargetSize(srcWidth, srcHeight);
    if (targetSize.width <= 0 || targetSize.height <= 0) {
      res.status(500).json({ error: "invalid target image size" });
      return;
    }

    let data;
    let info;
    try {
      ({ data, info } = await sharp(filePath, { animated: false })
        .resize({
          width: targetSize.width,
          height: targetSize.height,
          fit: "inside",
          withoutEnlargement: true
        })
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
    const pixelBuffer = Buffer.allocUnsafe(pixelCount * 2);

    for (let i = 0; i < pixelCount; i += 1) {
      const offset = i * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const rgb565 = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
      pixelBuffer.writeUInt16BE(rgb565, i * 2);
    }

    console.log(
      `[Gallery] Send image ${item.id}: ${srcWidth}x${srcHeight} -> ${width}x${height}, total=${pixelBuffer.length} bytes (single frame)`
    );

    const sent = await sendImageChunkedToDevice(sendToDevice, width, height, pixelBuffer);
    if (!sent.ok) {
      res.status(503).json({ error: sent.reason === "offline" ? "ESP32 is offline" : "send failed" });
      return;
    }
    res.json({
      ok: true,
      width,
      height,
      sourceWidth: srcWidth,
      sourceHeight: srcHeight,
      totalBytes: pixelBuffer.length,
      chunkBytes: pixelBuffer.length
    });
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
