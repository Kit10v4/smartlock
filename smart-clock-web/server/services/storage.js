const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const defaultStations = [
  { id: randomUUID(), name: "Radio Paradise", url: "https://stream.radioparadise.com/aac-320", genre: "Mix" },
  { id: randomUUID(), name: "BBC World Service", url: "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service", genre: "News" },
  { id: randomUUID(), name: "KEXP", url: "https://kexp.streamguys1.com/kexp160.aac", genre: "Indie" },
  { id: randomUUID(), name: "SomaFM Groove Salad", url: "https://ice6.somafm.com/groovesalad-128-mp3", genre: "Chill" },
  { id: randomUUID(), name: "Jazz24", url: "https://live.wostreaming.net/direct/ppm-jazz24mp3-ibc1", genre: "Jazz" }
];

const defaultData = {
  stations: defaultStations,
  playlist: [],
  gallery: [],
  youtubeHistory: [],
  settings: {
    city: process.env.DEFAULT_CITY || "Ho Chi Minh",
    brightness: 180,
    blinkColon: true,
    ampm: false,
    format24h: true,
    theme: "cyan"
  }
};

function getByPath(object, keyPath) {
  const parts = keyPath.split(".");
  let current = object;
  for (const key of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function setByPath(object, keyPath, value) {
  const parts = keyPath.split(".");
  let current = object;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

module.exports = function createStore(dbPath) {
  const resolvedPath = path.resolve(dbPath);
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let data = defaultData;
  if (fs.existsSync(resolvedPath)) {
    try {
      const raw = fs.readFileSync(resolvedPath, "utf8");
      data = { ...defaultData, ...JSON.parse(raw) };
    } catch {
      data = defaultData;
    }
  } else {
    fs.writeFileSync(resolvedPath, JSON.stringify(defaultData, null, 2), "utf8");
  }

  function save() {
    fs.writeFileSync(resolvedPath, JSON.stringify(data, null, 2), "utf8");
  }

  return {
    all() {
      return data;
    },
    get(keyPath, fallback = null) {
      const value = getByPath(data, keyPath);
      return value === undefined ? fallback : value;
    },
    set(keyPath, value) {
      setByPath(data, keyPath, value);
      save();
      return value;
    },
    push(keyPath, item) {
      const arr = this.get(keyPath, []);
      if (!Array.isArray(arr)) {
        throw new Error(`${keyPath} is not an array`);
      }
      arr.push(item);
      this.set(keyPath, arr);
      return item;
    },
    remove(keyPath, predicate) {
      const arr = this.get(keyPath, []);
      if (!Array.isArray(arr)) {
        throw new Error(`${keyPath} is not an array`);
      }
      const next = arr.filter((item) => !predicate(item));
      this.set(keyPath, next);
      return next;
    },
    update(keyPath, updater) {
      const current = this.get(keyPath);
      const next = updater(current);
      this.set(keyPath, next);
      return next;
    }
  };
};
