const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");

const BOT_CHECK_PATTERN = /sign in to confirm you(?:'|\u2019)re not a bot|use --cookies-from-browser or --cookies/i;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function resolveCookieConfig() {
  const fileFromEnv = String(process.env.YTDLP_COOKIES_FILE || "").trim();
  const base64FromEnv = String(process.env.YTDLP_COOKIES_B64 || "").trim();
  const browserFromEnv = String(process.env.YTDLP_COOKIES_FROM_BROWSER || "").trim();

  if (fileFromEnv) {
    if (!fs.existsSync(fileFromEnv)) {
      return {
        mode: "none",
        value: "",
        warning: `YTDLP_COOKIES_FILE not found: ${fileFromEnv}. Falling back to unauthenticated yt-dlp calls.`
      };
    }
    return { mode: "file", value: fileFromEnv, warning: "" };
  }

  if (base64FromEnv) {
    try {
      const decoded = Buffer.from(base64FromEnv, "base64").toString("utf8");
      const tempPath = path.join(os.tmpdir(), `yt-dlp-cookies-${process.pid}-${randomUUID()}.txt`);
      fs.writeFileSync(tempPath, decoded, "utf8");
      return { mode: "base64", value: tempPath, warning: "" };
    } catch {
      return {
        mode: "none",
        value: "",
        warning: "Failed to decode YTDLP_COOKIES_B64. Falling back to unauthenticated yt-dlp calls."
      };
    }
  }

  if (browserFromEnv) {
    return { mode: "browser", value: browserFromEnv, warning: "" };
  }

  return { mode: "none", value: "", warning: "" };
}

function buildSharedArgs(cookieConfig) {
  const args = ["--ignore-config", "--no-playlist", "--no-warnings", "--geo-bypass"];

  const userAgent = String(process.env.YTDLP_USER_AGENT || DEFAULT_USER_AGENT).trim();
  if (userAgent) {
    args.push("--user-agent", userAgent);
  }

  const extractorArgs = String(process.env.YTDLP_EXTRACTOR_ARGS || "youtube:player_client=android,web").trim();
  if (extractorArgs) {
    args.push("--extractor-args", extractorArgs);
  }

  if (cookieConfig.mode === "file" || cookieConfig.mode === "base64") {
    args.push("--cookies", cookieConfig.value);
  } else if (cookieConfig.mode === "browser") {
    args.push("--cookies-from-browser", cookieConfig.value);
  }

  return args;
}

function formatYtDlpError(rawMessage, cookieConfig) {
  const message = String(rawMessage || "yt-dlp failed").trim();
  if (!BOT_CHECK_PATTERN.test(message)) {
    return message;
  }

  if (cookieConfig.mode === "none") {
    return [
      "YouTube requested anti-bot verification.",
      "Configure one of YTDLP_COOKIES_FILE, YTDLP_COOKIES_B64, or YTDLP_COOKIES_FROM_BROWSER and retry.",
      `Original yt-dlp error: ${message}`
    ].join(" ");
  }

  return [
    `YouTube requested anti-bot verification while using cookie mode \"${cookieConfig.mode}\".`,
    "Your cookies may be expired; export fresh cookies and retry.",
    `Original yt-dlp error: ${message}`
  ].join(" ");
}

function createYtDlpRunner(cookieConfig) {
  const command = String(process.env.YTDLP_BINARY || "yt-dlp").trim() || "yt-dlp";
  const timeoutMs = Number(process.env.YTDLP_TIMEOUT_MS || 30000);
  const maxBufferMb = Number(process.env.YTDLP_MAX_BUFFER_MB || 10);
  const sharedArgs = buildSharedArgs(cookieConfig);

  return function runYtDlp(args) {
    const finalArgs = [...sharedArgs, ...args];
    return new Promise((resolve, reject) => {
      execFile(
        command,
        finalArgs,
        {
          timeout: Number.isFinite(timeoutMs) ? timeoutMs : 30000,
          maxBuffer: (Number.isFinite(maxBufferMb) ? maxBufferMb : 10) * 1024 * 1024
        },
        (error, stdout, stderr) => {
          if (error) {
            const message = stderr?.trim() || error.message || "yt-dlp failed";
            reject(new Error(formatYtDlpError(message, cookieConfig)));
            return;
          }
          resolve(stdout.trim());
        }
      );
    });
  };
}

module.exports = function createYouTubeService() {
  const audioCache = new Map();
  const infoCache = new Map();
  const searchCache = new Map();
  const audioTtlMs = 4 * 60 * 60 * 1000;
  const infoTtlMs = 30 * 60 * 1000;
  const searchTtlMs = 5 * 60 * 1000;

  const cookieConfig = resolveCookieConfig();
  if (cookieConfig.warning) {
    console.warn(cookieConfig.warning);
  }
  const runYtDlp = createYtDlpRunner(cookieConfig);

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

    const url = await runYtDlp(["-f", "bestaudio[ext=m4a]/bestaudio", "--get-url", youtubeURL]);

    return setCached(audioCache, youtubeURL, url);
  }

  async function getVideoInfo(youtubeURL) {
    const cached = getCached(infoCache, youtubeURL, infoTtlMs);
    if (cached) {
      return cached;
    }

    const stdout = await runYtDlp(["--dump-json", "--no-download", youtubeURL]);

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
      "--flat-playlist"
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
