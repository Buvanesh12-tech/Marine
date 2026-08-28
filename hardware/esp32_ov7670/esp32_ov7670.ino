/**
 * Marine Sentinel - ESP32 Dev Module + OV7670 Camera Gateway
 * 
 * Hardware Description:
 * - ESP32 Development Module
 * - OV7670 Camera connected directly via GPIO pins:
 *   SIOC/SCL  -> GPIO 22
 *   SIOD/SDA  -> GPIO 21
 *   XCLK/MCLK -> GPIO 4
 *   PCLK      -> GPIO 19
 *   VSYNC     -> GPIO 25
 *   HREF      -> GPIO 23
 *   D0        -> GPIO 5
 *   D1        -> GPIO 18
 *   D2        -> GPIO 27
 *   D3        -> GPIO 26
 *   D4        -> GPIO 35
 *   D5        -> GPIO 34
 *   D6        -> GPIO 32
 *   D7        -> GPIO 33
 *   RESET     -> 3.3V (Hardware pull-up)
 *   PWDN      -> GND (Hardware pull-down)
 * 
 * Purpose:
 * - Generate XCLK clock signal for OV7670.
 * - Configure OV7670 camera settings.
 * - Continuously capture frames and transmit JPEG images over Serial.
 */

#include "esp_camera.h"

// Camera Pin definitions matching instructions
#define PWDN_GPIO_NUM     -1 // Tied to GND
#define RESET_GPIO_NUM    -1 // Tied to 3.3V
#define XCLK_GPIO_NUM      4
#define SIOD_GPIO_NUM     21
#define SIOC_GPIO_NUM     22

#define Y9_GPIO_NUM       33 // D7
#define Y8_GPIO_NUM       32 // D6
#define Y7_GPIO_NUM       34 // D5
#define Y6_GPIO_NUM       35 // D4
#define Y5_GPIO_NUM       26 // D3
#define Y4_GPIO_NUM       27 // D2
#define Y3_GPIO_NUM       18 // D1
#define Y2_GPIO_NUM        5 // D0

#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     19

const unsigned long CAPTURE_INTERVAL = 3000; // Frame acquisition interval (ms)
unsigned long lastCaptureTime = 0;

void setup() {
  // Use high baud rate to transfer images rapidly over USB Serial
  Serial.begin(115200);
  
  // Wait for Serial Monitor to initialize
  delay(1000);
  Serial.println("\n[ESP32] Initializing Camera Gateway...");

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 10000000; // 10MHz XCLK for OV7670
  config.pixel_format = PIXFORMAT_JPEG;

  // QVGA offers optimal speed and is fully sufficient for YOLOv8 detection
  config.frame_size = FRAMESIZE_QVGA; // 320x240
  config.jpeg_quality = 15;           // 0-63 scale (lower quality number = sharper image)
  config.fb_count = 1;

  // Initialize camera driver
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ESP32] ERROR: Camera Init Failed (0x%x)\n", err);
    // Send periodic failure flags over Serial so Backend registers camera status
    while (true) {
      Serial.println("STATUS:CAMERA_FAILED");
      delay(5000);
    }
  }

  Serial.println("[ESP32] Camera Init Successful. Starting acquisition...");
}

void loop() {
  unsigned long currentTime = millis();
  if (currentTime - lastCaptureTime >= CAPTURE_INTERVAL) {
    captureAndSendFrame();
    lastCaptureTime = currentTime;
  }
}

void captureAndSendFrame() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("STATUS:CAMERA_CAPTURE_ERROR");
    return;
  }

  // Frame delimitation protocol over Serial:
  // *FRAME* (8-byte header) + 4-byte big-endian length + payload bytes + *END* (5-byte footer)
  Serial.write("*FRAME*");
  
  uint32_t len = fb->len;
  uint8_t lenBytes[4];
  lenBytes[0] = (len >> 24) & 0xFF;
  lenBytes[1] = (len >> 16) & 0xFF;
  lenBytes[2] = (len >> 8) & 0xFF;
  lenBytes[3] = len & 0xFF;
  Serial.write(lenBytes, 4);
  
  // Write the actual JPEG binary payload
  Serial.write(fb->buf, fb->len);
  
  Serial.write("*END*");
  Serial.println(); // Newline marker to finish line

  esp_camera_fb_return(fb);
}
