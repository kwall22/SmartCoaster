#include <BLEDevice.h>
#include <Wire.h>  
#include <Adafruit_MLX90614.h>
#include "HT_SSD1306Wire.h"
#include <FastLED.h>


#define DEVICE_NAME         "Smart Coaster"
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

#define LED_PIN     17
#define NUM_LEDS    12
#define BRIGHTNESS  64
#define LED_TYPE    WS2811
#define COLOR_ORDER GRB
CRGB leds[NUM_LEDS];

#define MLX_SDA 4
#define MLX_SCL 15
static SSD1306Wire  display(0x3c, 500000, SDA_OLED, SCL_OLED, GEOMETRY_128_64, RST_OLED); 
Adafruit_MLX90614 mlx = Adafruit_MLX90614();

BLECharacteristic *pCharacteristic;
String message = "";

void printToScreen(String s) {
  display.clear();
  display.drawString(0, 0, s);
  display.display();
}

float readTemperature() {
  return mlx.readObjectTempF();
}

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      printToScreen("BLE client connected.");
    };

    void onDisconnect(BLEServer* pServer) {
      printToScreen("BLE client disconnected.");
      BLEDevice::startAdvertising();
    }
};

int hottestTempThreshold = 120; //160; - 26
int coldestTempThreshold = 100; //130; -26
class MyCharacteristicCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) {
    message = String(characteristic->getValue().c_str());
    printToScreen("Received:\n" + message);
    Serial.println("Received:\n" + message);

    if (message.indexOf("Hottest:") >= 0 && message.indexOf("Coldest:") >= 0) {
      int hottestIndex = message.indexOf("Hottest:") + 8;
      int coldestIndex = message.indexOf("Coldest:") + 8;
      String hottestValue = message.substring(hottestIndex, message.indexOf(";", hottestIndex));
      String coldestValue = message.substring(coldestIndex);

      hottestTempThreshold = hottestValue.toInt();
      coldestTempThreshold = coldestValue.toInt();
      Serial.println("hottestTempThreshold: " + String(hottestTempThreshold));
      Serial.println("coldestTempThreshold: " + String(coldestTempThreshold));
    } else {
        Serial.println("Invalid message format");
    }
  }
};

#define NUM_COLORS 3
CRGB colors[NUM_COLORS] = { CRGB::Blue, CRGB::Yellow, CRGB::Red };

CRGB calculateGradientColor(float percent) {
  percent = constrain(percent, 0.0f, 1.0f);

  int colorIndex = floor(percent * (NUM_COLORS - 1));
  float blendFactor = (percent * (NUM_COLORS - 1)) - colorIndex;

  CRGB color = blend(colors[colorIndex], colors[colorIndex + 1], blendFactor * 255);
  return color;
}

void fillLEDs(float currentTemp, int brightness) {
  //int intTemp = (int)currentTemp;
  // Serial.print("Current Temp: ");
  // Serial.println(intTemp);
  //Serial.print("Coldest Threshold: "); Serial.println(coldestTempThreshold);
  //Serial.print("Hottest Threshold: "); Serial.println(hottestTempThreshold);
  FastLED.setBrightness(brightness);
  for (int i = 0; i < NUM_LEDS; i++) {
    float percent = (currentTemp - coldestTempThreshold) / (hottestTempThreshold - coldestTempThreshold);
    leds[i] = calculateGradientColor(percent);
  }
  FastLED.show();
}

#define MLX_SDA 4
#define MLX_SCL 15

void setup() {
  Serial.begin(9600);
  display.init();
  //sensor stuff
  bool wireStatus = Wire1.begin(MLX_SDA, MLX_SCL);
  bool mlxStatus = mlx.begin(MLX90614_I2CADDR, &Wire1);
  if (!mlxStatus) {
    Serial.println("Failed to find MLX90614 sensor");
    while (1);
  }
  //lights stuff
  delay(3000);
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS).setCorrection( TypicalLEDStrip );
  FastLED.setBrightness(BRIGHTNESS);

  BLEDevice::init(DEVICE_NAME);
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE
  );
  pCharacteristic->setCallbacks(new MyCharacteristicCallbacks());
  pCharacteristic->setValue("Init");
  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("Setup complete. Waiting for BLE connection");
}

int b = 0;
int dB = 1;

long lastLightChange = 0;
long lastTempRead = 0;

float currentTemperature = 0;

void loop() {
  long now = millis();

  if (now - lastLightChange > 10) {
    lastLightChange = now;
    b = b + dB;
    if (b < 60) {
      b = 60;
      dB *= -1;
    }
    if (b > 255) {
      b = 255;
      dB *= -1;
    }
    fillLEDs(currentTemperature, b);
  }

  if (now - lastTempRead > 500) {
    lastTempRead = now;

    // read the temp
    currentTemperature = readTemperature();
    Serial.print("Current Temp: ");
    Serial.print(currentTemperature);
    Serial.print(" time: ");
    Serial.println(now);

    String tempStr = "Temp: " + String(currentTemperature, 2) + " F";
    String justTempStr = String(currentTemperature, 2);
    pCharacteristic->setValue(justTempStr.c_str());
  }
}
