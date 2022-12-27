#include <Arduino.h>
#include <FastLED.h>
#include <limits.h>

// compiles code needed for the multiplexed display. comment out to disable
#define ENABLE_DISPLAY
// use an RGBW ledstrip instead of RGB. uncomment to enable
// #define RGBW

#define FADE_IN_ON_BOOT

// make sure to have the exact same rate on the host
#define BAUD_RATE 9600

#define serial_trash_bytes(n)                                                                      \
  do {                                                                                             \
    for (u8 i = 0; i < n; i++) {                                                                   \
      Serial.read();                                                                               \
    }                                                                                              \
  } while (0)

// message types
// type is always 1 byte, followed by a certain amount of data (type specific)
// undefined types can be assumed to have 0 bytes of data and ignored
// (arduino) means this message is sent from the arduino to the host
// all other messages are sent from the host to the arduino
enum msg_types {
  // 4 bytes, memcpy to u8 *display
  DISPLAY_WRITE = 0,
  // 5 bytes, 2 bytes u16 (le) led number, g, r, b
  // calls FastLED.show()
  LEDSTRIP_SET_LED_RGB = 1,
  // 0 bytes, clears
  LEDSTRIP_CLEAR = 2,
  // 0 bytes, sent when ready to receive once on startup (arduino)
  CONNECTED = 3,
  // 6 bytes, 2 bytes u16 (le) led number, g, r, b, w
  // calls FastLED.show()
  LEDSTRIP_SET_LED_RGBW = 4,
  // 0 bytes, sent when ready to receive after msg (arduino)
  MSG_RECVD = 5,
  // 3+3n bytes, 2 bytes u16 (le) led number, 1 byte length n, n times g, r, b
  // calls FastLED.show()
  LEDSTRIP_SET_LEDS_RGB = 6,
  // 3+4n bytes, 2 bytes u16 (le) led number, 1 byte length n, n times g, r, b, w
  // calls FastLED.show()
  LEDSTRIP_SET_LEDS_RGBW = 7,
  // 3 bytes, g, r, b
  // calls FastLED.show()
  LEDSTRIP_FILL_RGB = 8,
  // 4 bytes, g, r, b, w
  // calls FastLED.show()
  LEDSTRIP_FILL_RGBW = 9
};

// ledstrip settings
#define LEDSTRIP_PIN 10
#define NUM_LEDS (9 + 16 + 9 + 16 + 5)

#ifdef ENABLE_DISPLAY
// display settings

// number of displays
#define DISPLAYS 4

// frequency
#define DISPLAY_MULTIPLEX_FREQUENCY 120

// pin numbers of ground pins, from left to right
const u8 displayPins[DISPLAYS] = {5, A3, 6, A2};

// pin numbers of positive pins for the segments a to g and the decimal separator
const u8 segmentPins[8] = {A0, 8, 2, 4, A4, A1, 7, 3};

u8 disps[DISPLAYS] = {0};
#endif

#ifdef RGBW
#define LED_BYTES 4
#define FASTLED_NUM_LEDS ((NUM_LEDS * 4) / 3 + (NUM_LEDS * 4 % 3 != 0))
#else
#define LED_BYTES 3
#define FASTLED_NUM_LEDS NUM_LEDS
#endif

u8 ledstrip[NUM_LEDS][LED_BYTES] = {0};

void setup() {
  Serial.begin(BAUD_RATE);

  FastLED.addLeds<WS2812, LEDSTRIP_PIN, RGB>((CRGB *)ledstrip, FASTLED_NUM_LEDS);
#ifdef FADE_IN_ON_BOOT
  for (u8 i = 0; i < 0x3f; i++) {
    memset(&ledstrip, i + 1, 150);
    FastLED.show();
    delay(32);
  }
#endif

#ifdef ENABLE_DISPLAY
  for (u8 i = 0; i < 8; i++) {
    pinMode(segmentPins[i], OUTPUT);
    digitalWrite(segmentPins[i], 0);
  }

  for (u8 i = 0; i < DISPLAYS; i++) {
    pinMode(displayPins[i], OUTPUT);
    digitalWrite(displayPins[i], 1);
  }
#endif

  Serial.write(CONNECTED);
}

bool type_received = 0;
u8 type;
// when reading messages where the total length is not known
// before reading the header, the message could be read in 2 parts
// in between the 2 parts `header_received` and `type_received` are true (1)
bool header_received = 0;
u8 ledstrip_msg[4];
// points to the led number in a received message
#define ledstrip_msg_start (*((u16 *)(ledstrip_msg)))
// only for SET_LEDS_RGB{,W}
// points to the amount of leds in a received message
#define ledstrip_msg_length (*(ledstrip_msg + 2))

void loop() {
  if (!type_received) {
    if (Serial.available() >= 1) {
      Serial.readBytes(&type, 1);
      type_received = 1;
    }
  }
  if (type_received) {
    switch (type) {
    case DISPLAY_WRITE:
      if (Serial.available() >= 4) {
#ifdef ENABLE_DISPLAY
        Serial.readBytes(disps, 4);
#else
        serial_trash_bytes(4);
#endif
        Serial.write(MSG_RECVD);
        type_received = 0;
      }
      break;
    case LEDSTRIP_SET_LED_RGB:
      if (Serial.available() >= 5) {
        Serial.readBytes(ledstrip_msg, 2);
        if (ledstrip_msg_start < NUM_LEDS) {
          Serial.readBytes((u8 *)(ledstrip + ledstrip_msg_start), 3);
          FastLED.show();
        }
        Serial.write(MSG_RECVD);
        type_received = 0;
      }
      break;
    case LEDSTRIP_FILL_RGB:
      if (Serial.available() >= 3) {
        Serial.readBytes(ledstrip_msg, 3);
        for (u16 i = 0; i < NUM_LEDS; i++) {
          memcpy(ledstrip + i, ledstrip_msg, 3);
        }
        FastLED.show();
        Serial.write(MSG_RECVD);
        type_received = 0;
      }
      break;
    case LEDSTRIP_FILL_RGBW:
      if (Serial.available() >= 4) {
        Serial.readBytes(ledstrip_msg, 4);
        for (u16 i = 0; i < NUM_LEDS; i++) {
          memcpy(ledstrip + i, ledstrip_msg, 4);
        }
        FastLED.show();
        Serial.write(MSG_RECVD);
        type_received = 0;
      }
      break;
    case LEDSTRIP_CLEAR:
      memset(ledstrip, 0x00, LED_BYTES * NUM_LEDS);
      FastLED.show();
      Serial.write(MSG_RECVD);
      type_received = 0;
      break;
    case LEDSTRIP_SET_LED_RGBW:
      if (Serial.available() >= 6) {
        Serial.readBytes(ledstrip_msg, 2);
        if (ledstrip_msg_start < NUM_LEDS) {
          Serial.readBytes((u8 *)(ledstrip + ledstrip_msg_start), 4);
          FastLED.show();
        }
        Serial.write(MSG_RECVD);
        type_received = 0;
      }
      break;
    case LEDSTRIP_SET_LEDS_RGB:
      if (!header_received) {
        if (Serial.available() >= 3) {
          Serial.readBytes(ledstrip_msg, 3);
          header_received = 1;
        }
      } else {
        if (Serial.available() >= ledstrip_msg_length * 3) {
          Serial.readBytes((u8 *)(ledstrip + ledstrip_msg_start), ledstrip_msg_length * 3);
          FastLED.show();
          header_received = 0;
          Serial.write(MSG_RECVD);
          type_received = 0;
        }
      }
      break;
    case LEDSTRIP_SET_LEDS_RGBW:
      if (!header_received) {
        if (Serial.available() >= 3) {
          Serial.readBytes(ledstrip_msg, 3);
          header_received = 1;
        }
      } else {
        if (Serial.available() >= ledstrip_msg_length * 4) {
          Serial.readBytes((u8 *)(ledstrip + ledstrip_msg_start), ledstrip_msg_length * 4);
          FastLED.show();
          header_received = 0;
          Serial.write(MSG_RECVD);
          type_received = 0;
        }
      }
      break;
    default:
      Serial.write(MSG_RECVD);
      type_received = 0;
      break;
    }
  }

#ifdef ENABLE_DISPLAY
  // update displays
  // TODO more accurate timing with micros() than with delays
  // when working with microseconds the execution time of
  // the code itself has to be taken into account
  for (u8 i = 0; i < DISPLAYS; i++) {
    digitalWrite(displayPins[i], 0);
    for (u8 j = 0; j < 8; j++) {
      if (disps[i] & (1 << j)) {
        digitalWrite(segmentPins[j], 1);
      }
    }
#define DELAY_PER_DISPLAY (1000000UL / DISPLAY_MULTIPLEX_FREQUENCY / DISPLAYS)
#if DELAY_PER_DISPLAY < UINT_MAX
    delayMicroseconds(DELAY_PER_DISPLAY);
#else
    delay(DELAY_PER_DISPLAY / 1000);
#endif
    for (u8 j = 0; j < 8; j++) {
      digitalWrite(segmentPins[j], 0);
    }
    digitalWrite(displayPins[i], 1);
  }
#endif
}
