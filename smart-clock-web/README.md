# Smart Clock Web App

Companion web application for ESP32 Smart Clock:
- **Backend:** Express + WebSocket (`/ws`) + Socket.IO bridge
- **Frontend:** Next.js App Router UI (Dashboard, Music, Gallery, Weather, Settings)

## Project structure

```text
smart-clock-web/
├── server/   # Express backend
└── web/      # Next.js frontend
```

## 1) Run backend (server)

```bash
cd server
npm install
cp .env.example .env
npm start
```

Default server URL: `http://localhost:10000`

### Backend features included
- ESP32 WebSocket endpoint: `ws://localhost:10000/ws`
- Web app Socket.IO endpoint: `http://localhost:10000`
- REST APIs:
  - `/api/status`
  - `/api/stations`
  - `/api/youtube/play`, `/api/youtube/search`, `/api/youtube/history`
  - `/api/playlist`, `/api/playlist/:id/play`, `/api/playlist/queue`
  - `/api/upload/mp3`, `/api/upload/image`, `/api/upload/:id`
  - `/api/weather`, `/api/weather/city`
  - `/api/gallery`, `/api/gallery/upload`, `/api/gallery/:id/send`
  - `/api/settings`

### Notes
- `yt-dlp` is used for YouTube extraction (already prepared in `server/Dockerfile`).
- If `WEATHER_API_KEY` is missing, weather endpoint returns mock fallback data.

## 2) Run frontend (web)

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

Open: `http://localhost:3000`

## 3) Deploy

### Backend on Render (Docker)
Use `server/Dockerfile` and set env variables:
- `PORT=10000`
- `WEB_ORIGIN=https://<your-vercel-domain>`
- `WEATHER_API_KEY=<openweather-key>`

### Frontend on Vercel
Set:
- `NEXT_PUBLIC_API_URL=https://<render-domain>`
- `NEXT_PUBLIC_SOCKET_URL=https://<render-domain>`
- Firebase `NEXT_PUBLIC_FIREBASE_*` values if using Firebase in production

## 4) ESP32 protocol

This implementation already relays JSON commands and binary payloads between:
- Web app ⇄ Socket.IO
- Server ⇄ ESP32 WebSocket (`/ws`)

and supports queue auto-next via `track_end`.
