/**
 * Marine Sentinel - Main Arduino Controller Firmware
 * 
 * Hardware Description:
 * - Arduino Uno / Nano (Main microcontroller)
 * - GPS NEO-6M (SoftwareSerial on Pins 2, 3)
 * - MPU6050 Gyro/Accelerometer (I2C: SDA=A4, SCL=A5)
 * - 16x2 LCD with I2C Backpack (I2C: SDA=A4, SCL=A5)
 * - Turbidity Sensor (Analog Pin A0)
 * - IR Proximity Sensors (Digital Pins 4, 11, 12)
 * - Status LEDs (Red=13, Yellow=A1, Blue=A2)
 * - L298N Motor Driver (ENA=5, ENB=6, IN1=7, IN2=8, IN3=9, IN4=10)
 * - Serial Link to PC / Companion Computer (Hardware Serial: Pins 0/RX, 1/TX)
 * 
 * Dependencies:
 * - TinyGPS++ (by Mikal Hart)
 * - Adafruit MPU6050 (by Adafruit)
 * - Adafruit Unified Sensor (by Adafruit)
 * - LiquidCrystal_I2C (by Frank de Brabander)
 */

#include <Wire.h>
#include <SoftwareSerial.h>
#include <TinyGPS++.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <LiquidCrystal_I2C.h>

// PIN DEFINITIONS
#define PIN_TURBIDITY      A0
#define PIN_LED_RED        13
#define PIN_LED_YELLOW     A1
#define PIN_LED_BLUE       A2

#define PIN_IR_LEFT        4
#define PIN_IR_CENTER      11
#define PIN_IR_RIGHT       12

#define PIN_MOTOR_ENA      5
#define PIN_MOTOR_ENB      6
#define PIN_MOTOR_IN1      7
#define PIN_MOTOR_IN2      8
#define PIN_MOTOR_IN3      9
#define PIN_MOTOR_IN4      10

#define GPS_RX_PIN         2
#define GPS_TX_PIN         3

// CONSTANTS & CONFIGURATION
const unsigned long SEND_INTERVAL = 3000; // Telemetry transmit interval (ms)
const int TURBIDITY_THRESHOLD_CRITICAL = 600; // Example analog read threshold
const int TURBIDITY_THRESHOLD_WARNING = 400;

// OBJECT INITIALIZATION
TinyGPSPlus gps;
SoftwareSerial gpsSerial(GPS_RX_PIN, GPS_TX_PIN); // RX=2 (to GPS TX), TX=3 (to GPS RX)
Adafruit_MPU6050 mpu;
LiquidCrystal_I2C lcd(0x27, 16, 2);

// GLOBAL STATE
unsigned long lastSendTime = 0;
String systemStatus = "SAFE"; // SAFE (Blue), WARNING (Yellow), CRITICAL (Red)

void setup() {
  // Initialize Hardware Serial for PC / Dashboard communication
  Serial.begin(115200);

  // Initialize Software Serial for GPS
  gpsSerial.begin(9600);

  // Initialize LED Pins
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_BLUE, OUTPUT);

  // Set default LED state (Yellow - Booting / Monitoring Init)
  setLEDs(false, true, false);

  // Initialize IR Proximity Sensor Pins
  pinMode(PIN_IR_LEFT, INPUT);
  pinMode(PIN_IR_CENTER, INPUT);
  pinMode(PIN_IR_RIGHT, INPUT);

  // Initialize Motor Driver Pins
  pinMode(PIN_MOTOR_ENA, OUTPUT);
  pinMode(PIN_MOTOR_ENB, OUTPUT);
  pinMode(PIN_MOTOR_IN1, OUTPUT);
  pinMode(PIN_MOTOR_IN2, OUTPUT);
  pinMode(PIN_MOTOR_IN3, OUTPUT);
  pinMode(PIN_MOTOR_IN4, OUTPUT);
  stopMotors();

  // Initialize LCD Screen
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("MARINE SENTINEL");
  lcd.setCursor(0, 1);
  lcd.print("BOOTING...");

  // Initialize MPU6050 Gyro/Accel
  if (!mpu.begin()) {
    lcd.setCursor(0, 1);
    lcd.print("MPU6050 ERR!    ");
    delay(2000);
  } else {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }

  lcd.setCursor(0, 1);
  lcd.print("READY           ");
  delay(1000);
  
  // Start with default Blue (Ocean Safe) status after booting completes
  updateSystemStatus("SAFE");
}

void loop() {
  // 1. Process GPS incoming data from SoftwareSerial
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // 2. Process serial commands from PC / Dashboard (Steering Overrides)
  if (Serial.available() > 0) {
    handleIncomingCommand();
  }

  // 3. Read sensors & evaluate status
  int turbidityRaw = analogRead(PIN_TURBIDITY);
  bool obstacleLeft = (digitalRead(PIN_IR_LEFT) == LOW); // Active Low sensor assumed
  bool obstacleCenter = (digitalRead(PIN_IR_CENTER) == LOW);
  bool obstacleRight = (digitalRead(PIN_IR_RIGHT) == LOW);

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Determine System Status based on telemetry
  String newStatus = "SAFE";
  if (obstacleLeft || obstacleCenter || obstacleRight || turbidityRaw > TURBIDITY_THRESHOLD_CRITICAL) {
    newStatus = "CRITICAL";
  } else if (turbidityRaw > TURBIDITY_THRESHOLD_WARNING) {
    newStatus = "WARNING";
  }
  
  if (newStatus != systemStatus) {
    updateSystemStatus(newStatus);
  }

  // 4. Send telemetry JSON to PC / Dashboard periodically
  unsigned long currentTime = millis();
  if (currentTime - lastSendTime >= SEND_INTERVAL) {
    sendTelemetry(turbidityRaw, obstacleLeft, obstacleCenter, obstacleRight, a, g);
    updateLCD(turbidityRaw, obstacleLeft || obstacleCenter || obstacleRight);
    lastSendTime = currentTime;
  }
}

// Update LCD screen contents
void updateLCD(int turbidity, bool obstacle) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Status: ");
  lcd.print(systemStatus);
  
  lcd.setCursor(0, 1);
  if (obstacle) {
    lcd.print("OBSTACLE CLOSE!");
  } else {
    lcd.print("Turb: ");
    lcd.print(turbidity);
    lcd.print(" NTU");
  }
}

// Transmit structured JSON telemetry over Serial to PC / Dashboard
void sendTelemetry(int turbidity, bool obsL, bool obsC, bool obsR, sensors_event_t &accel, sensors_event_t &gyro) {
  Serial.print("{\"gps\":{");
  if (gps.location.isValid()) {
    Serial.print("\"lat\":");
    Serial.print(gps.location.lat(), 6);
    Serial.print(",\"lng\":");
    Serial.print(gps.location.lng(), 6);
    Serial.print(",\"spd\":");
    Serial.print(gps.speed.kmph());
  } else {
    Serial.print("\"lat\":0.0,\"lng\":0.0,\"spd\":0.0");
  }
  Serial.print("},\"turb\":");
  Serial.print(turbidity);
  
  // Simulate pH and Temp measurements since physical sensors are simulated at local level
  float simulated_ph = 7.2 + (random(-20, 21) / 100.0);
  float simulated_temp = 24.5 + (random(-5, 6) / 10.0);
  Serial.print(",\"ph\":");
  Serial.print(simulated_ph, 2);
  Serial.print(",\"temp\":");
  Serial.print(simulated_temp, 1);
  
  Serial.print(",\"gyro\":{");
  Serial.print("\"ax\":"); Serial.print(accel.acceleration.x, 2);
  Serial.print(",\"ay\":"); Serial.print(accel.acceleration.y, 2);
  Serial.print(",\"az\":"); Serial.print(accel.acceleration.z, 2);
  Serial.print(",\"gx\":"); Serial.print(gyro.gyro.x, 2);
  Serial.print(",\"gy\":"); Serial.print(gyro.gyro.y, 2);
  Serial.print(",\"gz\":"); Serial.print(gyro.gyro.z, 2);
  Serial.print("},\"ir\":[");
  Serial.print(obsL ? 1 : 0); Serial.print(",");
  Serial.print(obsC ? 1 : 0); Serial.print(",");
  Serial.print(obsR ? 1 : 0);
  Serial.print("],\"status\":\"");
  Serial.print(systemStatus);
  Serial.println("\"}");
}

// Process direct steering control packets from the dashboard
void handleIncomingCommand() {
  String cmd = Serial.readStringUntil('\n');
  cmd.trim();

  if (cmd.startsWith("CMD:")) {
    String action = cmd.substring(4);
    if (action == "FWD") {
      driveForward(200);
    } else if (action == "REV") {
      driveBackward(200);
    } else if (action == "LEFT") {
      turnLeft(180);
    } else if (action == "RIGHT") {
      turnRight(180);
    } else if (action == "STOP") {
      stopMotors();
    }
  }
}

// Update LEDs and global state
void updateSystemStatus(String status) {
  systemStatus = status;
  if (status == "SAFE") {
    setLEDs(false, false, true); // Blue
  } else if (status == "WARNING") {
    setLEDs(false, true, false); // Yellow
  } else if (status == "CRITICAL") {
    setLEDs(true, false, false); // Red
  }
}

void setLEDs(bool red, bool yellow, bool blue) {
  digitalWrite(PIN_LED_RED, red ? HIGH : LOW);
  digitalWrite(PIN_LED_YELLOW, yellow ? HIGH : LOW);
  digitalWrite(PIN_LED_BLUE, blue ? HIGH : LOW);
}

// MOTOR DRIVER HELPER FUNCTIONS
void driveForward(int speed) {
  analogWrite(PIN_MOTOR_ENA, speed);
  analogWrite(PIN_MOTOR_ENB, speed);
  digitalWrite(PIN_MOTOR_IN1, HIGH);
  digitalWrite(PIN_MOTOR_IN2, LOW);
  digitalWrite(PIN_MOTOR_IN3, HIGH);
  digitalWrite(PIN_MOTOR_IN4, LOW);
}

void driveBackward(int speed) {
  analogWrite(PIN_MOTOR_ENA, speed);
  analogWrite(PIN_MOTOR_ENB, speed);
  digitalWrite(PIN_MOTOR_IN1, LOW);
  digitalWrite(PIN_MOTOR_IN2, HIGH);
  digitalWrite(PIN_MOTOR_IN3, LOW);
  digitalWrite(PIN_MOTOR_IN4, HIGH);
}

void turnLeft(int speed) {
  analogWrite(PIN_MOTOR_ENA, speed);
  analogWrite(PIN_MOTOR_ENB, speed);
  digitalWrite(PIN_MOTOR_IN1, LOW);
  digitalWrite(PIN_MOTOR_IN2, HIGH);
  digitalWrite(PIN_MOTOR_IN3, HIGH);
  digitalWrite(PIN_MOTOR_IN4, LOW);
}

void turnRight(int speed) {
  analogWrite(PIN_MOTOR_ENA, speed);
  analogWrite(PIN_MOTOR_ENB, speed);
  digitalWrite(PIN_MOTOR_IN1, HIGH);
  digitalWrite(PIN_MOTOR_IN2, LOW);
  digitalWrite(PIN_MOTOR_IN3, LOW);
  digitalWrite(PIN_MOTOR_IN4, HIGH);
}

void stopMotors() {
  analogWrite(PIN_MOTOR_ENA, 0);
  analogWrite(PIN_MOTOR_ENB, 0);
  digitalWrite(PIN_MOTOR_IN1, LOW);
  digitalWrite(PIN_MOTOR_IN2, LOW);
  digitalWrite(PIN_MOTOR_IN3, LOW);
  digitalWrite(PIN_MOTOR_IN4, LOW);
}
