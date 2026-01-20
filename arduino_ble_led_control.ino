/*
  HM-10 BLE LED Control for Smart Attendance System
  
  Hardware:
  - Arduino UNO
  - HM-10 BLE Module
  - LED on Pin 12
  
  Wiring:
  HM10 TX  -> Arduino D2
  HM10 RX  -> Arduino D3
  HM10 VCC -> Arduino 5V
  HM10 GND -> Arduino GND
  
  LED Wiring:
  LED Anode  -> Arduino Pin 12
  LED Cathode -> GND (through 220 ohm resistor)
  
  Commands:
  '1' -> LED ON
  '0' -> LED OFF
*/

#include <SoftwareSerial.h>

// Define LED pin
#define ledPin 12

// Create software serial for HM-10
// RX pin: 2, TX pin: 3
SoftwareSerial HM10(2, 3);

char data;

void setup() {
  // Initialize LED pin
  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, LOW);  // LED OFF initially

  // Initialize hardware serial (for debugging)
  Serial.begin(9600);
  
  // Initialize software serial for HM-10
  HM10.begin(9600);  // HM-10 default baud rate is 9600

  // Print startup message
  Serial.println("================================");
  Serial.println("HM-10 BLE LED Control System");
  Serial.println("================================");
  Serial.println("Waiting for BLE commands...");
  Serial.println("Command '1' -> LED ON");
  Serial.println("Command '0' -> LED OFF");
  Serial.println("================================");
}

void loop() {
  // Check if data is available from HM-10
  if (HM10.available()) {
    // Read incoming character
    data = HM10.read();
    
    // Print received data
    Serial.print("Received: ");
    Serial.println(data);

    // Process command
    if (data == '1') {
      // Turn LED ON
      digitalWrite(ledPin, HIGH);
      Serial.println("OK LED turned ON");
    }
    else if (data == '0') {
      // Turn LED OFF
      digitalWrite(ledPin, LOW);
      Serial.println("OK LED turned OFF");
    }
    else {
      // Unknown command
      Serial.print("? Unknown command: ");
      Serial.println(data);
    }
  }
}

/*
  TESTING:
  
  1. Upload this code to Arduino
  2. Open Serial Monitor (9600 baud)
  3. Use BLE Scanner or student portal to send:
    - Send "1" -> LED should turn ON
    - Send "0" -> LED should turn OFF
  
  4. Check Serial Monitor for confirmation
  
  TROUBLESHOOTING:
  
  - If no "HM-10 BLE LED Control System" message appears:
    -> Check USB cable connection
    -> Check board selection in Arduino IDE
    -> Try different USB port
  
  - If commands not received:
    -> Check HM-10 wiring (D2, D3)
    -> Verify HM-10 is powered
    -> Check baud rate is 9600
    -> Test HM-10 with BLE Scanner app
  
  - If LED doesn't light:
    -> Check LED polarity (anode on pin 12)
    -> Check LED isn't burned out
    -> Try with a buzzer instead
    -> Verify pin 12 connection
*/
