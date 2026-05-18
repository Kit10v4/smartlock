/*
 * ================================================
 *   SMART CLOCK v3 - Synced with Web App
 *   ESP32-S3 N16R8 + ILI9341 + XPT2046
 *   + DS3231 + MAX98357
 * ================================================
 *
 * THƯ VIỆN:
 *   1. TFT_eSPI
 *   2. RTClib (Adafruit)
 *   3. ESP32-audioI2S (Schreibfaul1)
 *   4. ArduinoJson (Benoit Blanchon)
 *   5. WebSockets (Markus Sattler)
 */

#include <SPI.h>
#include <Wire.h>
#include <WiFi.h>
#include <TFT_eSPI.h>
#include <RTClib.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include "Audio.h"

// ==================== CẤU HÌNH ====================
const char* WIFI_SSID = "Nguyen Huy";
const char* WIFI_PASS = "0000000000";


const char* WS_HOST = "smartlock-tlxk.onrender.com";
const int   WS_PORT = 443;
const char* WS_PATH = "/ws";

#define I2S_BCLK  41
#define I2S_LRC   42
#define I2S_DOUT  40
#define AMP_SD    18
#define TFT_BL     7
#define RTC_SDA    8
#define RTC_SCL    9

// ==================== MÀU ====================
TFT_eSPI tft = TFT_eSPI();

#define C_BG         tft.color565(15, 15, 25)
#define C_CARD       tft.color565(30, 30, 45)
#define C_CARD2      tft.color565(45, 45, 65)
#define C_CYAN       tft.color565(0, 200, 255)
#define C_ORANGE     tft.color565(255, 160, 30)
#define C_GREEN      tft.color565(40, 220, 80)
#define C_RED        tft.color565(255, 60, 60)
#define C_WHITE      tft.color565(240, 240, 255)
#define C_GRAY       tft.color565(120, 120, 150)
#define C_DARK       tft.color565(60, 60, 80)
#define C_BTN        tft.color565(40, 40, 65)
#define C_PLAY       tft.color565(40, 200, 100)
#define C_STOP       tft.color565(220, 60, 60)
#define C_NAV        tft.color565(25, 25, 40)
#define C_YT_RED     tft.color565(255, 0, 0)

// ==================== ĐÀI RADIO (sync với server db.json) ====================
const char* stName[] = {"Radio Paradise", "BBC World", "KEXP", "SomaFM Chill", "Jazz24"};
const char* stURL[]  = {
  "https://stream.radioparadise.com/aac-320",
  "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service",
  "https://kexp.streamguys1.com/kexp160.aac",
  "https://ice6.somafm.com/groovesalad-128-mp3",
  "https://live.wostreaming.net/direct/ppm-jazz24mp3-ibc1"
};
const int NUM_ST = 5;

// ==================== ĐỐI TƯỢNG ====================
RTC_DS3231 rtc;
Audio audio;
WebSocketsClient ws;

// ==================== TRANG ====================
enum Page { PAGE_CLOCK, PAGE_RADIO, PAGE_WEATHER, PAGE_GIF, PAGE_COUNT };
const char* pageNames[] = {"Clock", "Radio", "Weather", "GIF"};

// ==================== NGUỒN ====================
enum Source { SRC_RADIO, SRC_YOUTUBE, SRC_UPLOAD, SRC_URL };

// ==================== QUEUE ====================
#define MAX_QUEUE 20
struct Track {
  char url[256];
  char title[64];
};
Track queue[MAX_QUEUE];
int queueLen = 0;
int queueIdx = -1;

// ==================== TRẠNG THÁI ====================
bool wifiOK    = false;
bool rtcOK     = false;
bool wsOK      = false;
bool isPlaying = false;
int  station   = 0;
int  vol       = 10;
int  prevMin   = -1;
int  prevSec   = -1;
int  brightness = 255;
Page curPage   = PAGE_CLOCK;
Source curSource = SRC_RADIO;
unsigned long lastTouch     = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastWsLoop    = 0;

char nowTitle[64]  = "";
char nowSource[16] = "radio";

// ==================== IMAGE RX (chunked) ====================
uint8_t*       imgBuf       = nullptr;
size_t         imgBufCap    = 0;
size_t         imgRxOffset  = 0;
size_t         imgExpected  = 0;
uint16_t       imgW         = 0;
uint16_t       imgH         = 0;
unsigned long  imgRxStart   = 0;
const unsigned long IMG_RX_TIMEOUT_MS = 20000;

// Thời tiết
float  wTemp     = 0;
int    wHumidity = 0;
float  wWind     = 0;
char   wDesc[32] = "---";
bool   wLoaded   = false;

uint16_t calData[5] = {300, 3600, 300, 3600, 7};

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== SMART CLOCK v3 ===");

  pinMode(TFT_BL, OUTPUT);
  analogWrite(TFT_BL, brightness);
  pinMode(AMP_SD, OUTPUT);
  digitalWrite(AMP_SD, LOW);

  tft.begin();
  tft.setRotation(3);
  tft.fillScreen(C_BG);
  tft.setSwapBytes(false);
  tft.setTouch(calData);

  splash("Starting...", 0);

  // RTC
  splash("RTC...", 1);
  Wire.begin(RTC_SDA, RTC_SCL);
  delay(100);
  rtcOK = rtc.begin();
  if (rtcOK && rtc.lostPower()) {
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  Serial.printf("RTC: %s\n", rtcOK ? "OK" : "FAIL");

  // WiFi
  splash("WiFi...", 2);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int i = 0; i < 40 && !WiFi.isConnected(); i++) delay(500);
  wifiOK = WiFi.isConnected();
  Serial.printf("WiFi: %s\n", wifiOK ? WiFi.localIP().toString().c_str() : "FAIL");

  // Audio
  splash("Audio...", 3);
  audio.setPinout(I2S_BCLK, I2S_LRC, I2S_DOUT);
  audio.setVolume(vol);

  // WebSocket
  splash("Server...", 4);
  if (wifiOK) {
    ws.beginSSL(WS_HOST, WS_PORT, WS_PATH);
    ws.onEvent(wsEvent);
    ws.setReconnectInterval(10000);  // Thử lại mỗi 10 giây (không spam)
  }

  splash("Ready!", 5);
  delay(400);
  drawPage();
  Serial.println("=== READY ===");
}

void splash(const char* msg, int step) {
  if (step == 0) {
    tft.fillScreen(C_BG);
    tft.setTextColor(C_CYAN);
    tft.setTextSize(3);
    tft.setCursor(40, 60);
    tft.print("SMART CLOCK");
    tft.fillRect(40, 95, 240, 3, C_CYAN);
    tft.drawRoundRect(40, 180, 240, 12, 6, C_CARD2);
  }
  tft.fillRect(40, 150, 240, 16, C_BG);
  tft.setTextSize(1);
  tft.setTextColor(C_GRAY);
  tft.setCursor(40, 152);
  tft.print(msg);
  int w = (step * 236) / 5;
  tft.fillRoundRect(42, 182, w, 8, 4, C_CYAN);
}

// ==================== LOOP ====================
void loop() {
  bool receivingImage = (imgBuf && imgExpected > 0);

  // Trong lúc nhận ảnh: tight loop, drain WS liên tục, bỏ tất cả các tick khác.
  // Lý do: chunks 4KB arrive mỗi ~8ms, TCP RX buffer ESP32 chỉ ~5KB → phải đọc kịp.
  if (receivingImage && wifiOK) {
    for (int i = 0; i < 8; i++) ws.loop();
    tickImageTimeout();
    return;
  }

  if (isPlaying) audio.loop();

  if (wifiOK && millis() - lastWsLoop >= 30) {
    lastWsLoop = millis();
    ws.loop();
  }

  tickClock();
  tickTouch();
  tickSerial();
  tickHeartbeat();
  tickImageTimeout();

  delay(15);
}

// ==================== HEARTBEAT ====================
void tickHeartbeat() {
  if (!wsOK || millis() - lastHeartbeat < 30000) return;
  lastHeartbeat = millis();

  char buf[200];
  snprintf(buf, sizeof(buf),
    "{\"type\":\"heartbeat\",\"page\":%d,\"playing\":%s,\"vol\":%d,"
    "\"rtc\":%s,\"wifi_rssi\":%d,\"source\":\"%s\"}",
    (int)curPage, isPlaying ? "true" : "false", vol,
    rtcOK ? "true" : "false", WiFi.RSSI(), nowSource);
  ws.sendTXT(buf);
}

void sendStatus() {
  if (!wsOK) return;
  char buf[200];
  snprintf(buf, sizeof(buf),
    "{\"type\":\"status\",\"playing\":%s,\"vol\":%d,"
    "\"source\":\"%s\",\"title\":\"%s\",\"station\":\"%s\"}",
    isPlaying ? "true" : "false", vol,
    nowSource, nowTitle,
    curSource == SRC_RADIO ? stName[station] : "");
  ws.sendTXT(buf);
}

// ==================== WEBSOCKET ====================
void wsEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      wsOK = true;
      Serial.println("[WS] Connected!");
      {
        char hello[150];
        snprintf(hello, sizeof(hello),
          "{\"type\":\"hello\",\"device\":\"smartclock\","
          "\"ip\":\"%s\",\"version\":\"3.0\"}",
          WiFi.localIP().toString().c_str());
        ws.sendTXT(hello);
      }
      // Cập nhật icon trên trang hiện tại
      if (curPage == PAGE_CLOCK) drawPageClock();
      if (curPage == PAGE_GIF) drawPageGIF();
      break;

    case WStype_DISCONNECTED:
      wsOK = false;
      Serial.println("[WS] Disconnected");
      break;

    case WStype_TEXT:
      handleWS((char*)payload);
      break;

    case WStype_BIN:
      Serial.printf("[WS] Binary received: %u bytes\n", length);
      handleWSImage(payload, length);
      break;

    default: break;
  }
}

void handleWS(char* msg) {
  Serial.printf("[WS] %s\n", msg);

  JsonDocument doc;
  if (deserializeJson(doc, msg)) return;

  const char* type = doc["type"] | "";

  // Radio
  if (strcmp(type, "play") == 0) doPlay();
  if (strcmp(type, "stop") == 0) { if (isPlaying) doStop(); }
  if (strcmp(type, "next") == 0) doNext();
  if (strcmp(type, "prev") == 0) doPrev();

  if (strcmp(type, "volume") == 0) {
    vol = constrain(doc["value"] | vol, 0, 21);
    audio.setVolume(vol);
    if (curPage == PAGE_RADIO) drawPageRadio();
    sendStatus();
  }

  if (strcmp(type, "station") == 0) {
    int idx = doc["index"] | -1;
    if (idx >= 0 && idx < NUM_ST) {
      station = idx;
      curSource = SRC_RADIO;
      strncpy(nowTitle, stName[station], sizeof(nowTitle));
      strncpy(nowSource, "radio", sizeof(nowSource));
      if (isPlaying) audio.connecttohost(stURL[station]);
      if (curPage == PAGE_RADIO) drawPageRadio();
      sendStatus();
    }
  }

  // Play URL (YouTube / MP3 / any)
  if (strcmp(type, "play_url") == 0) {
    const char* url = doc["url"] | "";
    const char* title = doc["title"] | "Unknown";
    const char* source = doc["source"] | "url";

    if (strlen(url) > 0) {
      strncpy(nowTitle, title, sizeof(nowTitle));
      strncpy(nowSource, source, sizeof(nowSource));

      if (strcmp(source, "youtube") == 0) curSource = SRC_YOUTUBE;
      else if (strcmp(source, "upload") == 0) curSource = SRC_UPLOAD;
      else curSource = SRC_URL;

      digitalWrite(AMP_SD, HIGH);
      delay(50);
      isPlaying = true;
      audio.connecttohost(url);
      Serial.printf("Play: %s [%s]\n", title, source);

      if (curPage == PAGE_RADIO) drawPageRadio();
      sendStatus();
    }
  }

  // Queue
  if (strcmp(type, "queue") == 0) {
    JsonArray tracks = doc["tracks"];
    queueLen = 0;
    for (JsonObject t : tracks) {
      if (queueLen >= MAX_QUEUE) break;
      strncpy(queue[queueLen].url, t["url"] | "", sizeof(queue[0].url));
      strncpy(queue[queueLen].title, t["title"] | "Track", sizeof(queue[0].title));
      queueLen++;
    }
    if (queueLen > 0) { queueIdx = 0; playQueueTrack(); }
  }

  // Page
  if (strcmp(type, "page") == 0) {
    int p = doc["page"] | 0;
    if (p >= 0 && p < PAGE_COUNT) {
      curPage = (Page)p;
      prevMin = -1; prevSec = -1;
      drawPage();
    }
  }

  // Notify
  if (strcmp(type, "notify") == 0) {
    const char* text = doc["text"] | "";
    showNotify(text);
  }

  // Set time
  if (strcmp(type, "set_time") == 0) {
    long ts = doc["timestamp"] | 0;
    if (ts > 0 && rtcOK) {
      rtc.adjust(DateTime((uint32_t)ts));
      prevMin = -1;
      if (curPage == PAGE_CLOCK) drawClock(true);
      if (wsOK) ws.sendTXT("{\"type\":\"ack\",\"command\":\"set_time\",\"success\":true}");
    }
  }

  // Brightness
  if (strcmp(type, "set_brightness") == 0) {
    brightness = constrain(doc["value"] | 255, 0, 255);
    analogWrite(TFT_BL, brightness);
    if (wsOK) ws.sendTXT("{\"type\":\"ack\",\"command\":\"set_brightness\",\"success\":true}");
  }

  // Restart
  if (strcmp(type, "restart") == 0) {
    if (wsOK) ws.sendTXT("{\"type\":\"ack\",\"command\":\"restart\",\"success\":true}");
    delay(500);
    ESP.restart();
  }

  // Image transfer (chunked)
  if (strcmp(type, "image_begin") == 0) {
    uint16_t w = doc["w"] | 0;
    uint16_t h = doc["h"] | 0;
    size_t total = doc["total"] | 0;
    imgBegin(w, h, total);
    return;
  }
  if (strcmp(type, "image_end") == 0) {
    imgEnd();
    return;
  }

  // Weather
  if (strcmp(type, "weather") == 0) {
    wTemp     = doc["temp"] | 0.0;
    wHumidity = doc["humidity"] | 0;
    wWind     = doc["wind"] | 0.0;
    const char* desc = doc["desc"] | "---";
    strncpy(wDesc, desc, sizeof(wDesc) - 1);
    wLoaded = true;
    if (curPage == PAGE_WEATHER) drawPageWeather();
    if (curPage == PAGE_CLOCK) drawWeatherMini();
  }
}

void imgAbort(const char* reason) {
  if (imgBuf) { heap_caps_free(imgBuf); imgBuf = nullptr; }
  imgBufCap = 0; imgRxOffset = 0; imgExpected = 0; imgW = 0; imgH = 0;
  if (reason) Serial.printf("[IMG] Abort: %s\n", reason);
}

bool imgEnsureBuffer(size_t needed) {
  if (imgBuf && imgBufCap >= needed) return true;
  if (imgBuf) heap_caps_free(imgBuf);
  imgBuf = (uint8_t*)heap_caps_malloc(needed, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (!imgBuf) imgBuf = (uint8_t*)heap_caps_malloc(needed, MALLOC_CAP_8BIT);
  if (!imgBuf) { imgBufCap = 0; return false; }
  imgBufCap = needed;
  return true;
}

void imgFinalize() {
  if (!imgBuf || imgRxOffset != imgExpected || imgW == 0 || imgH == 0) return;
  int x = max(0, (320 - (int)imgW) / 2);
  int y = max(0, (218 - (int)imgH) / 2);
  tft.fillRect(0, 0, 320, 218, TFT_BLACK);
  tft.setSwapBytes(false);  // pixel data is big-endian RGB565 (display byte order)
  tft.pushImage(x, y, imgW, imgH, (uint16_t*)imgBuf);
  Serial.printf("[IMG] Drawn %dx%d at %d,%d\n", imgW, imgH, x, y);
}

void imgBegin(uint16_t w, uint16_t h, size_t total) {
  imgAbort(nullptr);
  if (w == 0 || h == 0 || w > 320 || h > 240 || total != (size_t)w * h * 2) {
    Serial.printf("[IMG] Bad begin: %dx%d total=%u\n", w, h, (unsigned)total);
    return;
  }
  if (!imgEnsureBuffer(total)) {
    Serial.printf("[IMG] OOM for %u bytes\n", (unsigned)total);
    return;
  }
  imgW = w; imgH = h; imgExpected = total;
  imgRxOffset = 0;
  imgRxStart = millis();
  Serial.printf("[IMG] Begin %dx%d, %u bytes\n", w, h, (unsigned)total);
}

void imgEnd() {
  if (!imgBuf) { Serial.println("[IMG] End without buffer"); return; }
  if (imgRxOffset != imgExpected) {
    Serial.printf("[IMG] End incomplete: %u/%u\n", (unsigned)imgRxOffset, (unsigned)imgExpected);
    imgAbort("incomplete");
    return;
  }
  imgFinalize();
  imgAbort(nullptr);
}

void handleWSImage(uint8_t *data, size_t len) {
  if (!imgBuf || imgExpected == 0) {
    Serial.printf("[IMG] Unexpected chunk %u bytes (no transfer in progress)\n", (unsigned)len);
    return;
  }
  if (imgRxOffset + len > imgBufCap) { imgAbort("overflow"); return; }
  memcpy(imgBuf + imgRxOffset, data, len);
  imgRxOffset += len;
  // Auto-finalize when complete (in case image_end packet is lost)
  if (imgRxOffset >= imgExpected) {
    imgFinalize();
    imgAbort(nullptr);
  }
}

void tickImageTimeout() {
  if (imgBuf && imgExpected > 0 && (millis() - imgRxStart) > IMG_RX_TIMEOUT_MS) {
    imgAbort("timeout");
  }
}
// ==================== QUEUE ====================
void playQueueTrack() {
  if (queueIdx < 0 || queueIdx >= queueLen) return;
  strncpy(nowTitle, queue[queueIdx].title, sizeof(nowTitle));
  strncpy(nowSource, "queue", sizeof(nowSource));
  curSource = SRC_URL;
  digitalWrite(AMP_SD, HIGH);
  delay(50);
  isPlaying = true;
  audio.connecttohost(queue[queueIdx].url);
  if (curPage == PAGE_RADIO) drawPageRadio();
  sendStatus();
}

void playNextInQueue() {
  if (queueIdx + 1 < queueLen) {
    queueIdx++;
    playQueueTrack();
  } else {
    queueIdx = -1; queueLen = 0;
    isPlaying = false;
    digitalWrite(AMP_SD, LOW);
    nowTitle[0] = '\0';
    if (curPage == PAGE_RADIO) drawPageRadio();
    sendStatus();
  }
}

// ==================== ĐIỀU KHIỂN ====================
void doPlay() {
  if (!isPlaying && wifiOK) {
    curSource = SRC_RADIO;
    strncpy(nowTitle, stName[station], sizeof(nowTitle));
    strncpy(nowSource, "radio", sizeof(nowSource));
    digitalWrite(AMP_SD, HIGH);
    delay(50);
    isPlaying = true;
    audio.connecttohost(stURL[station]);
  }
  if (curPage == PAGE_RADIO) drawPageRadio();
  sendStatus();
}

void doStop() {
  isPlaying = false;
  audio.stopSong();
  digitalWrite(AMP_SD, LOW);
  nowTitle[0] = '\0';
  queueIdx = -1; queueLen = 0;
  if (curPage == PAGE_RADIO) drawPageRadio();
  sendStatus();
}

void doNext() {
  if (queueLen > 0 && queueIdx >= 0) { playNextInQueue(); return; }
  station = (station + 1) % NUM_ST;
  curSource = SRC_RADIO;
  strncpy(nowTitle, stName[station], sizeof(nowTitle));
  strncpy(nowSource, "radio", sizeof(nowSource));
  if (isPlaying) audio.connecttohost(stURL[station]);
  if (curPage == PAGE_RADIO) drawPageRadio();
  sendStatus();
}

void doPrev() {
  if (queueLen > 0 && queueIdx > 0) { queueIdx--; playQueueTrack(); return; }
  station = (station - 1 + NUM_ST) % NUM_ST;
  curSource = SRC_RADIO;
  strncpy(nowTitle, stName[station], sizeof(nowTitle));
  strncpy(nowSource, "radio", sizeof(nowSource));
  if (isPlaying) audio.connecttohost(stURL[station]);
  if (curPage == PAGE_RADIO) drawPageRadio();
  sendStatus();
}

void doVolUp()   { if (vol < 21) { vol++; audio.setVolume(vol); sendStatus(); } }
void doVolDown() { if (vol > 0)  { vol--; audio.setVolume(vol); sendStatus(); } }

// ==================== VẼ TRANG ====================
void drawPage() {
  tft.fillScreen(C_BG);
  drawNavBar();
  switch (curPage) {
    case PAGE_CLOCK:   drawPageClock();   break;
    case PAGE_RADIO:   drawPageRadio();   break;
    case PAGE_WEATHER: drawPageWeather(); break;
    case PAGE_GIF:     drawPageGIF();     break;
    default: break;
  }
  analogWrite(TFT_BL, brightness);
}

void drawNavBar() {
  tft.fillRect(0, 220, 320, 20, C_NAV);
  int tabW = 320 / PAGE_COUNT;
  for (int i = 0; i < PAGE_COUNT; i++) {
    int x = i * tabW;
    bool sel = (i == (int)curPage);
    if (sel) {
      tft.fillRect(x, 220, tabW, 20, C_CARD2);
      tft.fillRect(x, 220, tabW, 2, C_CYAN);
    }
    tft.setTextSize(1);
    tft.setTextColor(sel ? C_CYAN : C_GRAY, sel ? C_CARD2 : C_NAV);
    int tw = strlen(pageNames[i]) * 6;
    tft.setCursor(x + (tabW - tw) / 2, 228);
    tft.print(pageNames[i]);
  }
}

// ========== CLOCK ==========
void drawPageClock() {
  tft.setTextSize(1);
  tft.setCursor(8, 4);
  tft.setTextColor(wifiOK ? C_GREEN : C_RED, C_BG);
  tft.print(wifiOK ? "WiFi" : "Off");

  tft.setCursor(50, 4);
  tft.setTextColor(wsOK ? C_GREEN : C_DARK, C_BG);
  tft.print(wsOK ? "Server" : "");

  tft.setCursor(280, 4);
  tft.setTextColor(rtcOK ? C_GREEN : C_RED, C_BG);
  tft.print(rtcOK ? "RTC" : "ERR");

  prevMin = -1; prevSec = -1;
  drawClock(true);
  if (wLoaded) drawWeatherMini();
  if (isPlaying && nowTitle[0]) drawNowPlayingMini();
}

void drawClock(bool force) {
  if (!rtcOK) return;
  DateTime now = rtc.now();
  bool minChg = (now.minute() != prevMin);

  if (force || minChg) {
    prevMin = now.minute();
    tft.fillRect(0, 20, 280, 60, C_BG);

    tft.setTextSize(6);
    tft.setTextColor(C_WHITE, C_BG);
    tft.setCursor(30, 28);
    tft.printf("%02d", now.hour());
    tft.setTextColor(C_CYAN, C_BG);
    tft.print(":");
    tft.setTextColor(C_WHITE, C_BG);
    tft.printf("%02d", now.minute());

    const char* d[] = {"Chu nhat","Thu hai","Thu ba","Thu tu","Thu nam","Thu sau","Thu bay"};
    tft.fillRect(0, 90, 210, 30, C_BG);
    tft.setTextSize(2);
    tft.setTextColor(C_ORANGE, C_BG);
    tft.setCursor(30, 92);
    tft.print(d[now.dayOfTheWeek()]);
    tft.setTextSize(1);
    tft.setTextColor(C_GRAY, C_BG);
    tft.setCursor(30, 114);
    tft.printf("%02d/%02d/%04d", now.day(), now.month(), now.year());
  }

  if (now.second() != prevSec) {
    prevSec = now.second();
    tft.setTextSize(6);
    tft.setTextColor((now.second() % 2 == 0) ? C_CYAN : C_BG, C_BG);
    tft.setCursor(102, 28);
    tft.print(":");
  }
}

void drawWeatherMini() {
  int x = 220, y = 50;
  tft.fillRoundRect(x, y, 95, 65, 6, C_CARD);
  tft.setTextSize(1);
  tft.setTextColor(C_CYAN, C_CARD);
  tft.setCursor(x + 6, y + 6);
  tft.print("WEATHER");
  tft.setTextSize(2);
  tft.setTextColor(C_WHITE, C_CARD);
  tft.setCursor(x + 6, y + 22);
  tft.printf("%.0fC", wTemp);
  tft.setTextSize(1);
  tft.setTextColor(C_GRAY, C_CARD);
  tft.setCursor(x + 6, y + 44);
  char ds[12];
  strncpy(ds, wDesc, 11); ds[11] = '\0';
  tft.print(ds);
}

void drawNowPlayingMini() {
  int y = 140;
  tft.fillRoundRect(8, y, 304, 28, 6, C_CARD);
  tft.setTextSize(1);
  tft.setCursor(16, y + 5);
  if (curSource == SRC_YOUTUBE) { tft.setTextColor(C_YT_RED, C_CARD); tft.print("YT "); }
  else if (curSource == SRC_UPLOAD) { tft.setTextColor(C_GREEN, C_CARD); tft.print("MP3 "); }
  else { tft.setTextColor(C_CYAN, C_CARD); tft.print("RADIO "); }
  tft.setTextColor(C_WHITE, C_CARD);
  char t[35];
  strncpy(t, nowTitle, 34); t[34] = '\0';
  tft.print(t);
  tft.setTextColor(C_GREEN, C_CARD);
  tft.setCursor(16, y + 17);
  tft.printf("> Vol:%d", vol);
}

void tickClock() {
  if (curPage != PAGE_CLOCK || !rtcOK) return;
  DateTime now = rtc.now();
  if (now.second() != prevSec || now.minute() != prevMin)
    drawClock(false);
}

// ========== RADIO ==========
void drawPageRadio() {
  tft.fillRect(0, 0, 320, 218, C_BG);

  tft.setTextSize(1);
  tft.setCursor(8, 4);
  tft.setTextColor(C_CYAN, C_BG);
  tft.print("MUSIC");

  // Vol bar
  int bx = 200, bw = 60;
  tft.fillRect(bx, 6, bw, 5, C_DARK);
  int fw = map(vol, 0, 21, 0, bw);
  if (fw > 0) tft.fillRect(bx, 6, fw, 5, C_CYAN);
  tft.setTextColor(C_WHITE, C_BG);
  tft.setCursor(bx + bw + 4, 4);
  tft.printf("%2d", vol);

  // Now playing card
  tft.fillRoundRect(10, 20, 300, 55, 8, C_CARD);

  tft.setTextSize(1);
  tft.setCursor(20, 26);
  if (curSource == SRC_YOUTUBE) { tft.setTextColor(C_YT_RED, C_CARD); tft.print("YOUTUBE"); }
  else if (curSource == SRC_UPLOAD) { tft.setTextColor(C_GREEN, C_CARD); tft.print("MY MUSIC"); }
  else { tft.setTextColor(C_CYAN, C_CARD); tft.print("RADIO"); }

  tft.setCursor(240, 26);
  tft.setTextColor(isPlaying ? C_GREEN : C_GRAY, C_CARD);
  tft.print(isPlaying ? "PLAYING" : "STOPPED");

  tft.setTextSize(2);
  tft.setTextColor(C_WHITE, C_CARD);
  tft.setCursor(20, 45);
  char t[22];
  if (nowTitle[0]) { strncpy(t, nowTitle, 21); t[21] = '\0'; }
  else { strncpy(t, stName[station], 21); t[21] = '\0'; }
  tft.print(t);

  if (queueLen > 0) {
    tft.setTextSize(1);
    tft.setTextColor(C_GRAY, C_CARD);
    tft.setCursor(20, 62);
    tft.printf("Queue: %d/%d", queueIdx + 1, queueLen);
  }

  // Station dots
  if (curSource == SRC_RADIO) {
    int dotX = (320 - NUM_ST * 12) / 2;
    for (int i = 0; i < NUM_ST; i++) {
      if (i == station)
        tft.fillCircle(dotX + i * 12, 90, 4, C_CYAN);
      else
        tft.fillCircle(dotX + i * 12, 90, 3, C_DARK);
    }
  }

  // Buttons
  int bw2 = 60, bh = 40, gap = 10, y = 100;
  int total = bw2 * 3 + gap * 2;
  int sx = (320 - total) / 2;
  drawBtn(sx, y, bw2, bh, "<<", C_BTN);
  drawBtn(sx + bw2 + gap, y, bw2, bh, isPlaying ? "STOP" : "PLAY", isPlaying ? C_STOP : C_PLAY);
  drawBtn(sx + (bw2 + gap) * 2, y, bw2, bh, ">>", C_BTN);

  int vw = 90, vy = y + bh + 8;
  int vs = (320 - vw * 2 - gap) / 2;
  drawBtn(vs, vy, vw, 30, "VOL -", C_BTN);
  drawBtn(vs + vw + gap, vy, vw, 30, "VOL +", C_BTN);

  drawNavBar();
}

void drawBtn(int x, int y, int w, int h, const char* lbl, uint16_t bg) {
  tft.fillRoundRect(x, y, w, h, 6, bg);
  tft.drawRoundRect(x, y, w, h, 6, C_CARD2);
  int tw = strlen(lbl) * 6;
  tft.setTextSize(1);
  tft.setTextColor(C_WHITE, bg);
  tft.setCursor(x + (w - tw) / 2, y + (h - 8) / 2);
  tft.print(lbl);
}

// ========== WEATHER ==========
void drawPageWeather() {
  tft.setTextSize(1);
  tft.setCursor(8, 4);
  tft.setTextColor(C_CYAN, C_BG);
  tft.print("WEATHER");

  if (!wLoaded) {
    tft.setTextSize(2);
    tft.setTextColor(C_GRAY, C_BG);
    tft.setCursor(40, 80);
    tft.print("Cho du lieu...");
    tft.setTextSize(1);
    tft.setCursor(40, 110);
    tft.print("Mo web app -> Weather");
    return;
  }

  tft.setTextSize(5);
  tft.setTextColor(C_WHITE, C_BG);
  tft.setCursor(30, 35);
  tft.printf("%.0f", wTemp);
  tft.setTextSize(2);
  tft.print("C");

  tft.setTextSize(2);
  tft.setTextColor(C_ORANGE, C_BG);
  tft.setCursor(30, 85);
  tft.print(wDesc);

  tft.fillRoundRect(10, 120, 300, 70, 8, C_CARD);
  tft.setTextSize(1);
  tft.setTextColor(C_GRAY, C_CARD);
  tft.setCursor(20, 132); tft.print("Do am");
  tft.setTextSize(2);
  tft.setTextColor(C_CYAN, C_CARD);
  tft.setCursor(20, 148); tft.printf("%d%%", wHumidity);

  tft.setTextSize(1);
  tft.setTextColor(C_GRAY, C_CARD);
  tft.setCursor(130, 132); tft.print("Gio");
  tft.setTextSize(2);
  tft.setTextColor(C_CYAN, C_CARD);
  tft.setCursor(130, 148); tft.printf("%.1f", wWind);
}

// ========== GIF ==========
void drawPageGIF() {
  tft.setTextSize(1);
  tft.setCursor(8, 4);
  tft.setTextColor(C_CYAN, C_BG);
  tft.print("GIF DISPLAY");

  tft.fillRoundRect(20, 30, 280, 170, 8, C_CARD);
  tft.setTextSize(2);
  tft.setTextColor(C_GRAY, C_CARD);
  tft.setCursor(50, 85);
  tft.print("Gui GIF tu App");

  tft.setTextSize(1);
  tft.setCursor(50, 130);
  tft.setTextColor(wsOK ? C_GREEN : C_RED, C_CARD);
  tft.printf("Server: %s", wsOK ? "Connected" : "Offline");
  tft.setCursor(50, 150);
  tft.setTextColor(C_GRAY, C_CARD);
  tft.printf("IP: %s", WiFi.localIP().toString().c_str());
}

// ==================== NOTIFY ====================
void showNotify(const char* text) {
  tft.fillRoundRect(20, 85, 280, 50, 8, C_CARD);
  tft.drawRoundRect(20, 85, 280, 50, 8, C_CYAN);
  tft.setTextSize(1);
  tft.setTextColor(C_WHITE, C_CARD);
  tft.setCursor(30, 105);
  tft.print(text);
  delay(2000);
  drawPage();
}

// ==================== TOUCH ====================
void tickTouch() {
  uint16_t tx, ty;
  if (!tft.getTouch(&tx, &ty)) return;
  if (millis() - lastTouch < 350) return;
  lastTouch = millis();

  // Nav bar
  if (ty >= 220) {
    int tabW = 320 / PAGE_COUNT;
    int np = tx / tabW;
    if (np >= 0 && np < PAGE_COUNT && np != (int)curPage) {
      curPage = (Page)np;
      prevMin = -1; prevSec = -1;
      drawPage();
    }
    return;
  }

  if (curPage == PAGE_RADIO) touchRadio(tx, ty);
}

void touchRadio(uint16_t tx, uint16_t ty) {
  int bw = 60, bh = 40, gap = 10, y = 100;
  int total = bw * 3 + gap * 2;
  int sx = (320 - total) / 2;

  if (ty >= y && ty <= y + bh) {
    if (tx >= sx && tx < sx + bw) doPrev();
    else if (tx >= sx + bw + gap && tx < sx + bw * 2 + gap) {
      if (isPlaying) doStop(); else doPlay();
    }
    else if (tx >= sx + (bw + gap) * 2) doNext();
    drawPageRadio();
    return;
  }

  int vw = 90, vy = y + bh + 8;
  int vs = (320 - vw * 2 - gap) / 2;
  if (ty >= vy && ty <= vy + 30) {
    if (tx >= vs && tx < vs + vw) doVolDown();
    else if (tx >= vs + vw + gap) doVolUp();
    drawPageRadio();
  }
}

// ==================== SERIAL ====================
void tickSerial() {
  if (!Serial.available()) return;
  char c = Serial.read();
  switch (c) {
    case 'p': case 'P': if (isPlaying) doStop(); else doPlay(); break;
    case 'n': case 'N': doNext(); break;
    case 'b': case 'B': doPrev(); break;
    case '+': doVolUp();   if (curPage==PAGE_RADIO) drawPageRadio(); break;
    case '-': doVolDown(); if (curPage==PAGE_RADIO) drawPageRadio(); break;
    case '1': curPage=PAGE_CLOCK;   drawPage(); break;
    case '2': curPage=PAGE_RADIO;   drawPage(); break;
    case '3': curPage=PAGE_WEATHER; drawPage(); break;
    case '4': curPage=PAGE_GIF;     drawPage(); break;
    case 'i':
      Serial.printf("WiFi:%s WS:%s RTC:%s Vol:%d Src:%s Play:%s Q:%d/%d\n",
        wifiOK?"OK":"NO", wsOK?"OK":"NO", rtcOK?"OK":"NO",
        vol, nowSource, isPlaying?"Y":"N", queueIdx+1, queueLen);
      break;
  }
}

// ==================== AUDIO CALLBACKS ====================
void audio_info(const char* info) {
  Serial.printf("[a] %s\n", info);
}

void audio_showstreamtitle(const char* info) {
  Serial.printf("[title] %s\n", info);
  if (curSource == SRC_RADIO) {
    strncpy(nowTitle, info, sizeof(nowTitle));
    if (curPage == PAGE_RADIO) drawPageRadio();
    if (curPage == PAGE_CLOCK) drawNowPlayingMini();
  }
}

void audio_eof_stream(const char* info) {
  Serial.printf("[eof] %s\n", info);

  // Báo server bài hết → server tự gửi bài tiếp
  if (wsOK) ws.sendTXT("{\"type\":\"track_end\"}");

  if (queueLen > 0) {
    playNextInQueue();
  } else {
    isPlaying = false;
    digitalWrite(AMP_SD, LOW);
    nowTitle[0] = '\0';
    if (curPage == PAGE_RADIO) drawPageRadio();
    sendStatus();
  }
}
