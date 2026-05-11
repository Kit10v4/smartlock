# PROMPT: Xây dựng Web App cho dự án IoT Smart Clock

## 1. TỔNG QUAN DỰ ÁN

Tôi đang làm một **IoT Smart Clock** sử dụng ESP32-S3 N16R8 với màn hình TFT ILI9341 (320x240, cảm ứng). Đồng hồ đã có firmware hoàn chỉnh chạy trên ESP32, bao gồm: hiển thị giờ/ngày, phát radio internet, phát nhạc từ YouTube/MP3, xem thời tiết, nhận ảnh GIF, và điều khiển bằng cảm ứng.

Tôi cần bạn xây dựng **companion web application** (cả frontend lẫn backend) để điều khiển đồng hồ từ xa qua internet, phát nhạc từ YouTube và file MP3, gửi ảnh/GIF lên đồng hồ, và quản lý cài đặt.

---

## 2. TECH STACK YÊU CẦU

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | **Next.js** (React) | Deploy trên **Vercel** |
| Backend | **Express.js** + **Socket.IO** | Deploy trên **Render** |
| Giao tiếp ESP32 ↔ Server | **WebSocket** (ws hoặc Socket.IO client trên ESP32) |
| Database | **MongoDB Atlas** hoặc **Firebase Firestore** | Lưu playlist, cài đặt, danh sách đài |
| File Storage | **Firebase Storage** hoặc **Cloudinary** | Lưu MP3, ảnh, GIF đã upload |
| YouTube Audio | **yt-dlp** (chạy trên server) | Trích xuất audio URL từ YouTube |
| Weather API | **OpenWeatherMap** (free tier) | Lấy dữ liệu thời tiết |

---

## 3. KIẾN TRÚC HỆ THỐNG

```
┌─────────────┐     WebSocket (wss://)     ┌──────────────────────┐
│  ESP32-S3   │ ◄──────────────────────► │  Express Server      │
│ Smart Clock │                            │  (Render)            │
└─────────────┘                            │                      │
       │                                   │  ┌─ yt-dlp (YouTube) │
       │ Phát audio từ URL                 │  ├─ Weather API      │
       │ (MP3 stream trực tiếp)            │  ├─ Firebase Storage │
       │                                   │  └─ MongoDB/Firebase │
       │                                   └──────────┬───────────┘
       │                                              │ Socket.IO
       ▼                                              │
  ┌──────────┐                             ┌──────────┴───────────┐
  │ Internet │  ◄── stream URL ──────────  │  Next.js Frontend    │
  │ (MP3/AAC)│                             │  (Vercel)            │
  └──────────┘                             └──────────────────────┘
                                                      ▲
                                                      │ HTTPS
                                             ┌────────┴─────────┐
                                             │   Người dùng      │
                                             │   (Browser/Phone) │
                                             └──────────────────┘
```

**Luồng hoạt động:**
1. ESP32 kết nối WebSocket tới Express server khi khởi động
2. Người dùng mở web app trên trình duyệt/điện thoại
3. Web app kết nối Socket.IO tới cùng Express server
4. Server làm cầu nối trung chuyển lệnh giữa web app và ESP32
5. ESP32 gửi trạng thái về server → server đẩy lên web app real-time

**Luồng phát nhạc YouTube:**
1. Người dùng paste link YouTube vào web app
2. Web app gửi link lên server
3. Server dùng yt-dlp trích xuất direct audio URL
4. Server gửi URL xuống ESP32 qua WebSocket
5. ESP32 kết nối trực tiếp tới URL và phát audio qua loa

**Luồng phát MP3 upload:**
1. Người dùng upload file MP3 lên web app
2. Web app upload file lên Firebase Storage
3. Firebase trả về public URL
4. Server gửi URL xuống ESP32
5. ESP32 phát trực tiếp từ URL

---

## 4. TÍNH NĂNG CHI TIẾT

### 4.1. Dashboard chính
- Hiển thị **trạng thái kết nối** ESP32 (online/offline, IP, uptime)
- Hiển thị **giờ hiện tại** trên đồng hồ (đồng bộ từ ESP32)
- Hiển thị **trang đang hiện** trên đồng hồ (Clock/Radio/Weather/GIF)
- Nút chuyển đổi nhanh giữa các trang trên đồng hồ
- Hiển thị **thời tiết** hiện tại
- Hiển thị **bài đang phát** (tên bài, nguồn, thời lượng nếu có)
- Quick controls: Play/Stop, Volume, Next/Prev

### 4.2. Phát nhạc (Music Player) — TÍNH NĂNG CHÍNH

#### 4.2.1. Radio Internet
- Danh sách 5 đài radio mặc định (có sẵn)
- Nút **Play / Stop / Next / Prev**
- Thanh **chỉnh volume** (slider 0-21)
- Hiển thị đài đang phát và trạng thái
- Cho phép **thêm/xóa/sửa** đài radio

#### 4.2.2. YouTube Playback ⭐ MỚI
- **Ô nhập link YouTube** — paste URL video YouTube
- Nút **"Phát"** → server trích xuất audio URL → gửi xuống ESP32
- Hiển thị **tên bài**, **thumbnail**, **thời lượng** (lấy từ yt-dlp metadata)
- **Lịch sử phát** YouTube (lưu database)
- **Tìm kiếm YouTube** trực tiếp trên web app (dùng YouTube Data API v3 hoặc yt-dlp search)
- Hiển thị kết quả tìm kiếm dạng danh sách có thumbnail
- Nhấn vào kết quả → phát ngay

**Server-side YouTube processing:**
```javascript
// server/youtubeService.js
const { execFile } = require('child_process');

// Trích xuất audio URL
function getAudioURL(youtubeURL) {
  return new Promise((resolve, reject) => {
    execFile('yt-dlp', [
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '--get-url',
      '--no-warnings',
      youtubeURL
    ], (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

// Lấy metadata (tên bài, thumbnail, thời lượng)
function getVideoInfo(youtubeURL) {
  return new Promise((resolve, reject) => {
    execFile('yt-dlp', [
      '--dump-json',
      '--no-download',
      '--no-warnings',
      youtubeURL
    ], (err, stdout) => {
      if (err) reject(err);
      else {
        const info = JSON.parse(stdout);
        resolve({
          title: info.title,
          thumbnail: info.thumbnail,
          duration: info.duration,
          channel: info.uploader,
          url: youtubeURL
        });
      }
    });
  });
}

// Tìm kiếm YouTube
function searchYouTube(query, maxResults = 10) {
  return new Promise((resolve, reject) => {
    execFile('yt-dlp', [
      `ytsearch${maxResults}:${query}`,
      '--dump-json',
      '--no-download',
      '--flat-playlist',
      '--no-warnings'
    ], (err, stdout) => {
      if (err) reject(err);
      else {
        const results = stdout.trim().split('\n')
          .map(line => {
            try { return JSON.parse(line); }
            catch { return null; }
          })
          .filter(Boolean)
          .map(info => ({
            id: info.id,
            title: info.title,
            thumbnail: info.thumbnails?.[0]?.url || '',
            duration: info.duration,
            channel: info.uploader || info.channel,
            url: `https://www.youtube.com/watch?v=${info.id}`
          }));
        resolve(results);
      }
    });
  });
}
```

**LƯU Ý QUAN TRỌNG:**
- Audio URL từ YouTube **hết hạn sau vài giờ**. Nếu ESP32 disconnect rồi reconnect, cần extract lại URL mới.
- Server cần cài `yt-dlp`: thêm vào Dockerfile hoặc dùng `pip install yt-dlp` trong build script trên Render.
- Render free tier: thêm vào `render.yaml` hoặc `Dockerfile`:
```dockerfile
FROM node:18
RUN apt-get update && apt-get install -y python3 python3-pip
RUN pip3 install yt-dlp --break-system-packages
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "server/index.js"]
```

#### 4.2.3. Upload & Phát MP3 ⭐ MỚI
- Nút **upload MP3** từ máy tính hoặc điện thoại
- Hiển thị **progress bar** khi upload
- Lưu file lên **Firebase Storage** → lấy public URL
- **Playlist cá nhân**: danh sách các bài đã upload
  - Mỗi bài gồm: tên bài, nghệ sĩ (nhập tay hoặc đọc từ ID3 tag), URL, ngày upload
  - Cho phép **sắp xếp, xóa, đổi tên** bài trong playlist
- Nhấn bài trong playlist → server gửi URL xuống ESP32 phát
- **Hàng đợi phát** (queue): thêm nhiều bài, ESP32 phát lần lượt
- Hiển thị **bài đang phát** với tên, nghệ sĩ

**Frontend upload flow:**
```javascript
// Upload MP3 lên Firebase Storage
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

async function uploadMP3(file, onProgress) {
  const storage = getStorage();
  const fileRef = ref(storage, `music/${Date.now()}_${file.name}`);
  
  const uploadTask = uploadBytesResumable(fileRef, file);
  
  return new Promise((resolve, reject) => {
    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(progress);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
}
```

**ID3 Tag reading (đọc metadata từ MP3):**
```javascript
// Dùng thư viện jsmediatags trên frontend
import jsmediatags from 'jsmediatags';

function readMP3Tags(file) {
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: (tag) => {
        resolve({
          title: tag.tags.title || file.name.replace('.mp3', ''),
          artist: tag.tags.artist || 'Unknown',
          album: tag.tags.album || '',
        });
      },
      onError: () => {
        resolve({
          title: file.name.replace('.mp3', ''),
          artist: 'Unknown',
          album: '',
        });
      }
    });
  });
}
```

#### 4.2.4. Nguồn nhạc miễn phí khác (tùy chọn)
- **Jamendo API** — nhạc Creative Commons, có API chính thức
  - Tìm kiếm theo tên/thể loại
  - Stream hợp pháp, không hết hạn
  - API key miễn phí: https://developer.jamendo.com
- **Podcast RSS** — nhập URL RSS feed, server parse lấy danh sách episode MP3
- **URL trực tiếp** — ô nhập URL bất kỳ (MP3/AAC stream)

### 4.3. Gửi ảnh/GIF lên đồng hồ
- Nút **upload ảnh** (JPG/PNG/GIF) từ máy tính hoặc điện thoại
- Tự động **resize** ảnh về kích thước phù hợp màn hình (tối đa 320x240)
- Tự động **chuyển đổi** sang format RGB565 (2 bytes/pixel)
- **Xem trước** ảnh trên web trước khi gửi
- Nút **"Gửi lên đồng hồ"** → truyền dữ liệu pixel qua WebSocket
- Với file GIF: tách từng frame, gửi lần lượt với delay giữa các frame
- Thư viện ảnh đã gửi (lưu trên cloud storage)
- **Gallery** ảnh/GIF mẫu có sẵn để chọn nhanh

**Giao thức truyền ảnh (binary WebSocket):**
```
Byte 0-1: width (uint16, big endian)
Byte 2-3: height (uint16, big endian)  
Byte 4+:  pixel data (RGB565, 2 bytes/pixel, big endian)
          Tổng: width × height × 2 bytes

Ví dụ ảnh 100x80:
  [0x00, 0x64, 0x00, 0x50, ...16000 bytes pixel data...]
```

**Giao thức truyền GIF (nhiều frame):**
```json
// Gửi text message trước
{"type": "gif_start", "frames": 10, "width": 100, "height": 80, "delay": 100}

// Rồi gửi từng frame binary (cùng format như ảnh)
// Server relay từng frame xuống ESP32
// ESP32 hiển thị và chờ delay ms rồi hiện frame tiếp

// Kết thúc
{"type": "gif_end"}
```

### 4.4. Thời tiết
- Hiển thị thời tiết chi tiết trên web: nhiệt độ, độ ẩm, gió, mô tả, icon
- Cho phép **đổi thành phố** (lưu cài đặt)
- Tự động cập nhật mỗi 15 phút
- Gửi dữ liệu thời tiết xuống ESP32 qua WebSocket

### 4.5. Cài đặt đồng hồ
- **Chỉnh giờ** thủ công (gửi timestamp xuống ESP32 để set RTC)
- **Đồng bộ giờ** tự động từ server (NTP)
- **Chỉnh độ sáng** màn hình (ESP32 điều khiển PWM trên chân TFT_BL)
- **Đổi WiFi** (gửi SSID/pass mới, ESP32 lưu vào Preferences)
- **Chọn theme màu** cho đồng hồ
- **Bật/tắt** các tính năng (nhấp nháy dấu :, hiện AM/PM, format 12h/24h)
- **Restart** ESP32 từ xa
- **Quản lý storage** — xem dung lượng đã dùng, xóa file cũ

---

## 5. GIAO THỨC WEBSOCKET CHI TIẾT

### 5.1. Web App → Server → ESP32 (Lệnh điều khiển)

```json
// ====== RADIO ======
{"type": "play"}
{"type": "stop"}
{"type": "next"}
{"type": "prev"}
{"type": "volume", "value": 15}
{"type": "station", "index": 2}

// ====== YOUTUBE ======
{"type": "play_url", "url": "http://...audio-url...", "title": "Tên bài", "source": "youtube"}
// Server extract URL trước, rồi gửi play_url xuống ESP32

// ====== MP3 UPLOAD ======
{"type": "play_url", "url": "https://firebase.../song.mp3", "title": "Tên bài", "source": "upload"}
// ESP32 phát URL trực tiếp từ Firebase Storage

// ====== PLAYLIST QUEUE ======
{"type": "queue", "tracks": [
  {"url": "http://...", "title": "Bài 1"},
  {"url": "http://...", "title": "Bài 2"}
]}
// ESP32 phát lần lượt, khi hết bài 1 tự chuyển bài 2

// ====== ĐIỀU HƯỚNG ======
{"type": "page", "page": 0}
// page: 0=Clock, 1=Radio, 2=Weather, 3=GIF

// ====== THÔNG BÁO ======
{"type": "notify", "text": "Hello from App!"}

// ====== CÀI ĐẶT ======
{"type": "set_time", "timestamp": 1715400000}
{"type": "set_brightness", "value": 200}
{"type": "restart"}

// ====== THỜI TIẾT ======
{"type": "weather", "temp": 32.5, "humidity": 75, "wind": 3.2, "desc": "Nang nhe", "icon": "01d"}
```

### 5.2. ESP32 → Server → Web App (Trạng thái)

```json
// Khi ESP32 kết nối
{"type": "hello", "device": "smartclock", "ip": "192.168.1.184", "version": "2.0"}

// Trạng thái radio / nhạc (gửi khi có thay đổi)
{"type": "status", "playing": true, "station": "Radio Paradise", "vol": 10, "source": "radio"}
{"type": "status", "playing": true, "title": "Tên bài YouTube", "vol": 10, "source": "youtube"}
{"type": "status", "playing": true, "title": "Tên bài MP3", "vol": 10, "source": "upload"}

// Trạng thái chung (gửi định kỳ mỗi 30 giây)
{"type": "heartbeat", "page": 0, "playing": false, "vol": 10, "rtc": true, "wifi_rssi": -45}

// Khi bài hát kết thúc (để server gửi bài tiếp theo trong queue)
{"type": "track_end"}

// Xác nhận lệnh
{"type": "ack", "command": "play_url", "success": true}
```

### 5.3. Server logic

```
Server cần:
1. Quản lý kết nối ESP32 (WebSocket /ws endpoint)
2. Quản lý kết nối Web App (Socket.IO)
3. Relay message giữa web app ↔ ESP32
4. Lưu trạng thái cuối cùng (để web app mới kết nối nhận được ngay)
5. Xử lý binary data (ảnh) từ web app → relay xuống ESP32
6. Gọi Weather API và cache kết quả
7. ⭐ YouTube: nhận link từ web app → yt-dlp extract audio URL → gửi play_url xuống ESP32
8. ⭐ Quản lý playlist queue: khi ESP32 gửi "track_end" → gửi bài tiếp theo
9. ⭐ Cache YouTube URL + metadata (tránh extract lại nếu chưa hết hạn)
```

---

## 6. THIẾT KẾ UI/UX WEB APP

### Layout
- **Responsive** — hoạt động tốt trên cả desktop và điện thoại
- **Dark theme** — phù hợp với giao diện đồng hồ
- **Bottom navigation** (mobile) hoặc **sidebar** (desktop) với 5 tab:
  1. 🏠 Dashboard
  2. 🎵 Music (Radio + YouTube + Playlist)
  3. 🖼️ Gallery (GIF/Ảnh)
  4. 🌤️ Weather
  5. ⚙️ Settings

### Bảng màu
- Nền: `#0F0F19`
- Card: `#1E1E2D`
- Card hover: `#2A2A3D`
- Accent chính: `#00C8FF` (cyan)
- Accent phụ: `#FFA01E` (cam)
- Text: `#F0F0FF`
- Text mờ: `#787890`
- Success: `#28DC50`
- Error: `#FF3C3C`
- YouTube red: `#FF0000`

### Trang Music (UI chi tiết)

```
┌──────────────────────────────────────────┐
│  🎵 Music                    [Vol ████ 10]│
├──────────────────────────────────────────┤
│                                          │
│  [🔴 Radio] [▶ YouTube] [📁 Library]    │  ← 3 sub-tabs
│                                          │
│  ═══ Nếu tab YouTube ═══                │
│  ┌────────────────────────────────────┐  │
│  │ 🔍 Tìm kiếm hoặc paste link...    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Kết quả tìm kiếm:                      │
│  ┌──────┬────────────────────────────┐  │
│  │ 🖼️  │ Tên bài hát               │  │
│  │ thumb│ Channel • 3:45     [▶ Phát]│  │
│  ├──────┼────────────────────────────┤  │
│  │ 🖼️  │ Tên bài hát 2             │  │
│  │ thumb│ Channel • 4:12     [▶ Phát]│  │
│  └──────┴────────────────────────────┘  │
│                                          │
│  ═══ Nếu tab Library ═══                │
│  ┌────────────────────────────────────┐  │
│  │ [📤 Upload MP3]                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  My Playlist (12 bài):                   │
│  ┌────────────────────────────────────┐  │
│  │ 🎵 Bài 1 - Nghệ sĩ A    [▶] [🗑]│  │
│  │ 🎵 Bài 2 - Nghệ sĩ B    [▶] [🗑]│  │
│  │ 🎵 Bài 3 - Nghệ sĩ C    [▶] [🗑]│  │
│  └────────────────────────────────────┘  │
│                                          │
├──────────────────────────────────────────┤
│  NOW PLAYING:                            │
│  ▶ Tên bài đang phát     [⏮][⏸][⏭]  │
│  Nguồn: YouTube           Vol: ████ 15  │
└──────────────────────────────────────────┘
```

### Yêu cầu UX
- Hiện **trạng thái kết nối** ESP32 rõ ràng (đèn xanh/đỏ)
- Mọi nút bấm phải có **feedback** ngay lập tức
- Hiện **toast notification** khi gửi lệnh thành công/thất bại
- Upload MP3 có **progress bar** + đọc tên bài từ ID3 tag tự động
- YouTube search có **loading skeleton** khi đang tìm
- Radio controls phải đủ lớn và dễ bấm trên điện thoại
- Volume slider mượt, gửi giá trị khi thả (debounce)
- **Now Playing bar** luôn hiện ở dưới cùng khi đang phát nhạc

---

## 7. API ENDPOINTS (Express Server)

```
REST API:

# Trạng thái
GET    /api/status              → Trạng thái ESP32 hiện tại

# Radio
GET    /api/stations            → Danh sách đài radio
POST   /api/stations            → Thêm đài mới
PUT    /api/stations/:id        → Sửa đài
DELETE /api/stations/:id        → Xóa đài

# YouTube ⭐
POST   /api/youtube/play        → Body: {url: "https://youtube.com/watch?v=xxx"}
                                   Server extract audio URL → gửi xuống ESP32
                                   Response: {title, thumbnail, duration, audioUrl}
GET    /api/youtube/search?q=   → Tìm kiếm YouTube, trả về danh sách kết quả
GET    /api/youtube/history     → Lịch sử phát YouTube

# Playlist / Library ⭐
GET    /api/playlist             → Danh sách bài trong playlist
POST   /api/playlist             → Thêm bài (upload MP3 hoặc thêm URL)
PUT    /api/playlist/:id         → Sửa thông tin bài (tên, nghệ sĩ)
DELETE /api/playlist/:id         → Xóa bài
POST   /api/playlist/:id/play   → Phát bài này → gửi play_url xuống ESP32
POST   /api/playlist/queue      → Phát toàn bộ playlist theo thứ tự

# Upload
POST   /api/upload/mp3           → Upload file MP3, lưu Firebase Storage
                                    Response: {url, title, artist, duration}
POST   /api/upload/image         → Upload ảnh, xử lý RGB565
DELETE /api/upload/:id           → Xóa file đã upload

# Thời tiết
GET    /api/weather              → Thời tiết (cached)
POST   /api/weather/city         → Đổi thành phố

# Gallery
GET    /api/gallery              → Danh sách ảnh/GIF đã upload
POST   /api/gallery/upload       → Upload ảnh lên cloud storage
POST   /api/gallery/:id/send     → Gửi ảnh xuống ESP32
DELETE /api/gallery/:id          → Xóa ảnh

# Cài đặt
GET    /api/settings             → Lấy cài đặt hiện tại
PUT    /api/settings             → Cập nhật cài đặt

WebSocket:
WS     /ws                      → ESP32 kết nối vào đây
Socket.IO /                     → Web app kết nối vào đây
```

---

## 8. CẤU TRÚC THƯ MỤC

```
smart-clock-web/
├── server/                        # Express backend
│   ├── index.js                   # Entry point + WebSocket + Socket.IO
│   ├── Dockerfile                 # Có cài yt-dlp
│   │
│   ├── services/
│   │   ├── wsHandler.js           # WebSocket handler cho ESP32
│   │   ├── socketHandler.js       # Socket.IO handler cho web app
│   │   ├── youtubeService.js      # ⭐ yt-dlp: extract URL, search, metadata
│   │   ├── weatherService.js      # OpenWeatherMap API
│   │   ├── imageProcessor.js      # Resize + convert RGB565
│   │   ├── queueManager.js        # ⭐ Quản lý hàng đợi phát nhạc
│   │   └── firebaseService.js     # ⭐ Firebase Storage upload
│   │
│   ├── routes/
│   │   ├── stations.js
│   │   ├── youtube.js             # ⭐ YouTube endpoints
│   │   ├── playlist.js            # ⭐ Playlist endpoints
│   │   ├── upload.js              # ⭐ Upload MP3/image
│   │   ├── weather.js
│   │   ├── gallery.js
│   │   └── settings.js
│   │
│   ├── models/                    # MongoDB models (nếu dùng)
│   │   ├── Station.js
│   │   ├── Track.js               # ⭐ Bài nhạc trong playlist
│   │   ├── Setting.js
│   │   └── History.js             # ⭐ Lịch sử phát
│   │
│   └── package.json
│
├── web/                           # Next.js frontend
│   ├── app/
│   │   ├── page.tsx               # Dashboard
│   │   ├── music/page.tsx         # ⭐ Music (Radio + YouTube + Library)
│   │   ├── gallery/page.tsx       # GIF/Image gallery
│   │   ├── weather/page.tsx       # Thời tiết
│   │   └── settings/page.tsx      # Cài đặt
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── NavBar.tsx
│   │   │   ├── StatusIndicator.tsx
│   │   │   └── NowPlayingBar.tsx  # ⭐ Thanh phát nhạc dưới cùng
│   │   │
│   │   ├── dashboard/
│   │   │   ├── ClockDisplay.tsx
│   │   │   ├── WeatherMini.tsx
│   │   │   └── QuickControls.tsx
│   │   │
│   │   ├── music/
│   │   │   ├── RadioTab.tsx
│   │   │   ├── YouTubeTab.tsx     # ⭐ Tìm kiếm + phát YouTube
│   │   │   ├── LibraryTab.tsx     # ⭐ Upload MP3 + playlist
│   │   │   ├── YouTubeSearch.tsx  # ⭐ Ô tìm kiếm + kết quả
│   │   │   ├── TrackItem.tsx      # ⭐ 1 bài trong danh sách
│   │   │   ├── MP3Uploader.tsx    # ⭐ Upload MP3 với progress
│   │   │   ├── VolumeSlider.tsx
│   │   │   └── PlayerControls.tsx
│   │   │
│   │   ├── gallery/
│   │   │   ├── ImageUploader.tsx
│   │   │   ├── GalleryGrid.tsx
│   │   │   └── ImagePreview.tsx
│   │   │
│   │   └── weather/
│   │       └── WeatherCard.tsx
│   │
│   ├── hooks/
│   │   ├── useSocket.ts           # Socket.IO client hook
│   │   └── usePlayer.ts          # ⭐ Hook quản lý trạng thái phát nhạc
│   │
│   ├── lib/
│   │   ├── socket.ts              # Socket.IO setup
│   │   ├── api.ts                 # REST API calls
│   │   ├── imageUtils.ts          # RGB565 conversion
│   │   └── firebase.ts            # ⭐ Firebase client setup
│   │
│   ├── package.json
│   └── next.config.js
│
└── README.md
```

---

## 9. XỬ LÝ ẢNH RGB565

ESP32 với ILI9341 dùng format màu **RGB565** (16-bit). Web app cần chuyển đổi ảnh trước khi gửi.

```javascript
function imageToRGB565(imageData, width, height) {
  const buffer = new ArrayBuffer(4 + width * height * 2);
  const view = new DataView(buffer);
  view.setUint16(0, width);
  view.setUint16(2, height);
  
  let offset = 4;
  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i], g = imageData[i+1], b = imageData[i+2];
    const rgb565 = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
    view.setUint16(offset, rgb565);
    offset += 2;
  }
  return buffer;
}

function resizeImage(file, maxWidth = 320, maxHeight = 240) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidth)  { h = h * maxWidth / w;  w = maxWidth; }
      if (h > maxHeight) { w = w * maxHeight / h; h = maxHeight; }
      canvas.width = Math.floor(w);
      canvas.height = Math.floor(h);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      resolve(imageToRGB565(imageData, canvas.width, canvas.height));
    };
    img.src = URL.createObjectURL(file);
  });
}
```

---

## 10. GIF PROCESSING

```javascript
import { parseGIF, decompressFrames } from 'gifuct-js';

async function processGIF(file, socket) {
  const buffer = await file.arrayBuffer();
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true);
  
  socket.emit('to_device', {
    type: 'gif_start', frames: frames.length,
    width: gif.lsd.width, height: gif.lsd.height,
    delay: frames[0].delay || 100
  });
  
  for (const frame of frames) {
    const canvas = document.createElement('canvas');
    canvas.width = gif.lsd.width;
    canvas.height = gif.lsd.height;
    const ctx = canvas.getContext('2d');
    const imageData = new ImageData(
      new Uint8ClampedArray(frame.patch),
      frame.dims.width, frame.dims.height
    );
    ctx.putImageData(imageData, frame.dims.left, frame.dims.top);
    const fullData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    socket.emit('to_device_binary', imageToRGB565(fullData.data, canvas.width, canvas.height));
    await new Promise(r => setTimeout(r, frame.delay || 100));
  }
  
  socket.emit('to_device', { type: 'gif_end' });
}
```

---

## 11. QUEUE MANAGER (Server-side)

```javascript
// server/services/queueManager.js
class QueueManager {
  constructor() {
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
  }

  setQueue(tracks) {
    this.queue = tracks; // [{url, title, source}, ...]
    this.currentIndex = 0;
  }

  addToQueue(track) {
    this.queue.push(track);
  }

  getCurrentTrack() {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length)
      return this.queue[this.currentIndex];
    return null;
  }

  next() {
    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      return this.getCurrentTrack();
    }
    return null; // Hết queue
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.getCurrentTrack();
    }
    return null;
  }

  // Gọi khi ESP32 gửi "track_end"
  onTrackEnd() {
    return this.next();
  }
}

module.exports = new QueueManager();
```

---

## 12. DEPLOYMENT

### Frontend (Vercel)
```
Environment variables:
  NEXT_PUBLIC_API_URL      = https://your-app.onrender.com
  NEXT_PUBLIC_SOCKET_URL   = https://your-app.onrender.com
  NEXT_PUBLIC_FIREBASE_*   = Firebase config values
```

### Backend (Render)
```
Dockerfile (bắt buộc — cần yt-dlp):

FROM node:18
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg
RUN pip3 install yt-dlp --break-system-packages
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 10000
CMD ["node", "server/index.js"]

Environment variables:
  PORT               = 10000
  WEATHER_API_KEY    = (OpenWeatherMap API key)
  MONGODB_URI        = (MongoDB Atlas connection string)
  FIREBASE_*         = (Firebase admin SDK credentials)
```

### Firebase Setup
```
1. Tạo project Firebase
2. Bật Firebase Storage (cho upload MP3 + ảnh)
3. Bật Firestore (cho playlist, settings — hoặc dùng MongoDB thay)
4. Lấy config cho frontend (apiKey, authDomain, storageBucket...)
5. Tạo Service Account cho server (Firebase Admin SDK)
6. Storage rules cho phép read public, write chỉ qua server
```

---

## 13. THÔNG TIN ESP32 FIRMWARE

Firmware ESP32 đã hoàn chỉnh (KHÔNG cần viết lại):

- **Hardware:** ESP32-S3 N16R8, ILI9341 TFT 320x240, XPT2046 touch, DS3231 RTC, MAX98357 I2S audio amp, loa 4Ω 3W
- **Giao diện:** 4 trang (Clock, Radio, Weather, GIF) với tab navigation cảm ứng
- **Radio:** 5 đài internet radio, play/stop/next/prev/volume qua touch
- **Audio:** Phát bất kỳ URL stream MP3/AAC/M4A qua MAX98357. Nhận URL từ server qua `{"type":"play_url","url":"..."}` và phát trực tiếp. Hỗ trợ cả radio stream lẫn file MP3 trên cloud.
- **WebSocket client:** ESP32 kết nối tới server qua WSS, nhận JSON commands và binary image data
- **Thời tiết:** Hiển thị nhiệt độ, độ ẩm, gió
- **GIF:** Nhận raw RGB565 frames qua WebSocket binary, hiển thị bằng `tft.pushImage()`
- **Track end:** Khi bài hát kết thúc, ESP32 gửi `{"type":"track_end"}` để server gửi bài tiếp theo trong queue

ESP32 đã xử lý tất cả các message type liệt kê ở mục 5.1.

---

## 14. ƯU TIÊN PHÁT TRIỂN

**Phase 1 — MVP (tuần 1-2):**
1. Express server với WebSocket + Socket.IO bridge
2. Next.js dashboard hiển thị trạng thái ESP32
3. Radio controls (play/stop/next/prev/volume)
4. Deploy lên Render (Dockerfile) + Vercel

**Phase 2 — Music (tuần 3-4):**
5. ⭐ YouTube: paste link → phát, tìm kiếm YouTube
6. ⭐ Upload MP3 → Firebase Storage → phát
7. ⭐ Playlist management (thêm/xóa/sắp xếp/phát queue)
8. Now Playing bar

**Phase 3 — Media (tuần 5):**
9. Upload ảnh + chuyển đổi RGB565 + gửi xuống ESP32
10. GIF processing + gửi từng frame
11. Gallery quản lý ảnh đã upload

**Phase 4 — Polish (tuần 6):**
12. Weather display + cài đặt thành phố
13. Settings page (brightness, WiFi, time sync, theme)
14. Lịch sử phát, thống kê
15. PWA support (cài web app lên điện thoại như app native)

---

## 15. LƯU Ý KỸ THUẬT

1. **yt-dlp trên Render:** Bắt buộc dùng Dockerfile vì Render native runtime không có yt-dlp/python. Dockerfile đã cung cấp ở mục 12.

2. **YouTube URL hết hạn:** Audio URL từ yt-dlp hết hạn sau ~6 giờ. Server nên cache URL + thời gian extract, và re-extract khi cần.

3. **Firebase Storage CORS:** Cần cấu hình CORS trên Firebase Storage bucket để cho phép upload từ domain Vercel.

4. **WebSocket trên Render:** Render hỗ trợ WebSocket nhưng free tier sleep sau 15 phút. ESP32 firmware đã có reconnect logic.

5. **Binary data qua Socket.IO:** Socket.IO hỗ trợ binary natively. Dùng `socket.emit('event', arrayBuffer)`.

6. **CORS Express:** Server cần cho phép CORS từ domain Vercel frontend.

7. **Ảnh 320x240 RGB565** = 153,600 bytes (~150KB). WebSocket handle được nhưng nên chunk nếu cần.

8. **GIF animation:** Mỗi frame gửi riêng, ESP32 buffer 1 frame (giới hạn RAM). Không gửi tất cả frame cùng lúc.

9. **ESP32 WebSocket library:** `WebSocketsClient` (Markus Sattler). Hỗ trợ WSS. Server cần endpoint `/ws` chấp nhận upgrade WebSocket.

10. **MP3 file size:** Firebase Storage free tier = 5GB. Một bài MP3 ~5-10MB. Đủ cho ~500-1000 bài.

11. **yt-dlp update:** yt-dlp cần update thường xuyên vì YouTube hay đổi format. Thêm `RUN pip3 install --upgrade yt-dlp` vào Dockerfile hoặc setup cron job.

12. **Rate limiting:** Giới hạn số lần gọi YouTube search/extract để tránh bị block. Khuyến nghị: cache kết quả search 5 phút, cache audio URL 4 giờ.
