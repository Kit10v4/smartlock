const { execFile } = require("child_process");

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile("yt-dlp", args, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const message = stderr?.trim() || error.message || "yt-dlp failed";
        reject(new Error(message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

module.exports = function createYouTubeService() {
  const audioCache = new Map();
  const infoCache = new Map();
  const searchCache = new Map();
  const audioTtlMs = 4 * 60 * 60 * 1000;
  const infoTtlMs = 30 * 60 * 1000;
  const searchTtlMs = 5 * 60 * 1000;

  function getCached(cache, key, ttlMs) {
    const cached = cache.get(key);
    if (!cached) {
      return null;
    }
    if (Date.now() - cached.timestamp > ttlMs) {
      cache.delete(key);
      return null;
    }
    return cached.value;
  }

  function setCached(cache, key, value) {
    cache.set(key, { value, timestamp: Date.now() });
    return value;
  }

  async function getAudioURL(youtubeURL) {
    const cached = getCached(audioCache, youtubeURL, audioTtlMs);
    if (cached) {
      return cached;
    }

    const url = await runYtDlp([
      "-f",
      "bestaudio[ext=m4a]/bestaudio",
      "--get-url",
      "--no-warnings",
      youtubeURL
    ]);

    return setCached(audioCache, youtubeURL, url);
  }

  async function getVideoInfo(youtubeURL) {
    const cached = getCached(infoCache, youtubeURL, infoTtlMs);
    if (cached) {
      return cached;
    }

    const stdout = await runYtDlp([
      "--dump-json",
      "--no-download",
      "--no-warnings",
      youtubeURL
    ]);

    const info = JSON.parse(stdout);
    const value = {
      title: info.title || "Unknown title",
      thumbnail: info.thumbnail || "",
      duration: info.duration || 0,
      channel: info.uploader || info.channel || "",
      url: youtubeURL
    };

    return setCached(infoCache, youtubeURL, value);
  }

  async function searchYouTube(query, maxResults = 10) {
    const normalized = `${query}:${maxResults}`;
    const cached = getCached(searchCache, normalized, searchTtlMs);
    if (cached) {
      return cached;
    }

    const stdout = await runYtDlp([
      `ytsearch${maxResults}:${query}`,
      "--dump-json",
      "--no-download",
      "--flat-playlist",
      "--no-warnings"
    ]);

    const results = stdout
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .map((info) => ({
        id: info.id,
        title: info.title,
        thumbnail: info.thumbnails?.[0]?.url || "",
        duration: info.duration || 0,
        channel: info.uploader || info.channel || "",
        url: `https://www.youtube.com/watch?v=${info.id}`
      }));

    return setCached(searchCache, normalized, results);
  }

  return {
    getAudioURL,
    getVideoInfo,
    searchYouTube
  };
};
