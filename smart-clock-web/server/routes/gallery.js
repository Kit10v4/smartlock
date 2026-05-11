const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const express = require("express");
const multer = require("multer");

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

  router.post("/:id/send", (req, res) => {
    const item = store.get("gallery", []).find((entry) => entry.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: "item not found" });
      return;
    }
    const sent = sendToDevice({ type: "notify", text: `Gallery item selected: ${item.name}` });
    if (!sent) {
      res.status(503).json({ error: "ESP32 is offline" });
      return;
    }
    res.json({ ok: true, item });
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
