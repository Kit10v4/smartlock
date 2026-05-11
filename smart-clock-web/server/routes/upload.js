const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const express = require("express");
const multer = require("multer");

module.exports = function uploadRoutes({ store }, uploadsDir) {
  const router = express.Router();

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      cb(null, `${Date.now()}-${randomUUID()}${ext}`);
    }
  });

  const upload = multer({ storage });

  router.post("/mp3", upload.single("file"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "file is required" });
      return;
    }
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

    const track = {
      id: randomUUID(),
      title: req.body.title || req.file.originalname.replace(/\.mp3$/i, ""),
      artist: req.body.artist || "Unknown",
      duration: Number(req.body.duration || 0),
      source: "upload",
      url: fileUrl,
      filename: req.file.filename,
      createdAt: new Date().toISOString()
    };
    store.push("playlist", track);
    res.status(201).json(track);
  });

  router.post("/image", upload.single("file"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "file is required" });
      return;
    }
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
    const item = {
      id: randomUUID(),
      name: req.body.name || req.file.originalname,
      type: req.file.mimetype,
      url: fileUrl,
      filename: req.file.filename,
      createdAt: new Date().toISOString()
    };
    store.push("gallery", item);
    res.status(201).json(item);
  });

  router.delete("/:id", (req, res) => {
    const id = req.params.id;
    const playlist = store.get("playlist", []);
    const gallery = store.get("gallery", []);
    const track = playlist.find((item) => item.id === id);
    const image = gallery.find((item) => item.id === id);

    const target = track || image;
    if (!target) {
      res.status(404).json({ error: "item not found" });
      return;
    }

    store.set(
      "playlist",
      playlist.filter((item) => item.id !== id)
    );
    store.set(
      "gallery",
      gallery.filter((item) => item.id !== id)
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
