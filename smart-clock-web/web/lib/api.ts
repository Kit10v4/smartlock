const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";

type Method = "GET" | "POST" | "PUT" | "DELETE";

async function request<T>(path: string, method: Method, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  if (response.status === 204) {
    return null as T;
  }
  return response.json();
}

export const api = {
  getStatus: () => request("/api/status", "GET"),
  getStations: () => request("/api/stations", "GET"),
  saveStation: (payload: unknown) => request("/api/stations", "POST", payload),
  updateStation: (id: string, payload: unknown) => request(`/api/stations/${id}`, "PUT", payload),
  deleteStation: (id: string) => request(`/api/stations/${id}`, "DELETE"),
  youtubePlay: (url: string) => request("/api/youtube/play", "POST", { url }),
  youtubeSearch: (q: string) => request(`/api/youtube/search?q=${encodeURIComponent(q)}`, "GET"),
  youtubeHistory: () => request("/api/youtube/history", "GET"),
  getPlaylist: () => request("/api/playlist", "GET"),
  createTrack: (payload: unknown) => request("/api/playlist", "POST", payload),
  updateTrack: (id: string, payload: unknown) => request(`/api/playlist/${id}`, "PUT", payload),
  deleteTrack: (id: string) => request(`/api/playlist/${id}`, "DELETE"),
  playTrack: (id: string) => request(`/api/playlist/${id}/play`, "POST"),
  queuePlaylist: (tracks?: unknown[]) => request("/api/playlist/queue", "POST", { tracks }),
  getWeather: () => request("/api/weather", "GET"),
  setCity: (city: string) => request("/api/weather/city", "POST", { city }),
  getGallery: () => request("/api/gallery", "GET"),
  sendGallery: (id: string) => request(`/api/gallery/${id}/send`, "POST"),
  deleteGallery: (id: string) => request(`/api/gallery/${id}`, "DELETE"),
  getSettings: () => request("/api/settings", "GET"),
  saveSettings: (payload: unknown) => request("/api/settings", "PUT", payload)
};

export async function uploadFile(path: string, file: File, fields?: Record<string, string>) {
  const form = new FormData();
  form.append("file", file);
  if (fields) {
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  }
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    body: form
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Upload failed");
  }
  return response.json();
}
