/*
  arduino_led.ino — Jvalyx CRITICAL alert indicator
  
  Listens on Serial (9600 baud) for single-char commands:
    'C' → CRITICAL: turn on built-in LED (pin 13)
    'N' → NORMAL/reset: turn off LED

  No external components needed — uses the built-in LED on pin 13.
  Upload via Arduino IDE to any Uno / Nano / Mega board.
*/

const int ledPin = LED_BUILTIN;  // pin 13 on Uno/Nano

void setup() {
  Serial.begin(9600);
  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, LOW);
  
  // Startup blink to confirm the board is ready
  for (int i = 0; i < 3; i++) {
    digitalWrite(ledPin, HIGH);
    delay(100);
    digitalWrite(ledPin, LOW);
    delay(100);
  }
}

void loop() {
  if (Serial.available() > 0) {
    char cmd = Serial.read();

    if (cmd == 'C') {
      // CRITICAL — light up
      digitalWrite(ledPin, HIGH);
      Serial.println("ACK:CRITICAL");
    }
    else if (cmd == 'N') {
      // Back to normal — off
      digitalWrite(ledPin, LOW);
      Serial.println("ACK:NORMAL");
    }
  }
}
