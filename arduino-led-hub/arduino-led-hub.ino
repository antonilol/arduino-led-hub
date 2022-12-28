#include <Arduino.h>
#include <FastLED.h>
#include <limits.h>

#include "config.h"

#ifdef RGBW
#define FASTLED_NUM_LEDS ((NUM_LEDS * 4) / 3 + (NUM_LEDS * 4 % 3 != 0))
#else
#define FASTLED_NUM_LEDS NUM_LEDS
#endif

#define serial_trash_bytes(n)                                                                      \
  do {                                                                                             \
    for (u8 i = 0; i < n; i++) {                                                                   \
      Serial.read();                                                                               \
    }                                                                                              \
  } while (0)

// message types
// type is always 1 byte, followed by a certain amount of data (type specific)
// undefined types are assumed to have 0 bytes of data and are ignored

// message types for messages sent from the host to the Arduino
// messages specific to rgb or rgbw will have the LSB (1<<0) set to 0 for rgb and 1 for rgbw
enum rx_msg_type {
  // 3+3n bytes, 2 bytes u16 (le) led number, 1 byte length n, n times g, r, b
  LEDSTRIP_SET_LEDS_RGB = 0x00,
  // 3+4n bytes, 2 bytes u16 (le) led number, 1 byte length n, n times g, r, b, w
  LEDSTRIP_SET_LEDS_RGBW = 0x01,
  // LEDSTRIP_SET_LEDS_RGB but also updates the led strip
  LEDSTRIP_SET_LEDS_RGB_UPDATE = 0x02,
  // LEDSTRIP_SET_LEDS_RGBW but also updates the led strip
  LEDSTRIP_SET_LEDS_RGBW_UPDATE = 0x03,
  // 3 bytes, g, r, b
  // updates the led strip
  LEDSTRIP_FILL_RGB = 0x04,
  // 4 bytes, g, r, b, w
  // updates the led strip
  LEDSTRIP_FILL_RGBW = 0x05,
  // 4 bytes, memcpy to u8 *display
  DISPLAY_WRITE = 0x06
};
#define LEDSTRIP_RGBW_BIT 0x01
#define LEDSTRIP_SET_LEDS_UPDATE_BIT 0x02

// message types for messages sent from the Arduino to the host
enum tx_msg_type {
  // 0 bytes, sent when ready to receive a msg, also after booting up
  READY = 0x00
};

u8 ledstrip[FASTLED_NUM_LEDS * 3] = {0};

#ifdef ENABLE_DISPLAY
u8 disps[DISPLAYS] = {0};
#endif

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

  Serial.write(READY);
}

bool type_received = 0;
// see rx_msg_type
u8 type;
// 4 if the current message has the LSB (1<<0) set, see rx_msg_type, otherwise 3
u8 color_bytes;

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
      color_bytes = (type & LEDSTRIP_RGBW_BIT) + 3;
      type_received = 1;
    }
  }
  if (type_received) {
    switch (type) {
    case LEDSTRIP_SET_LEDS_RGB:
    case LEDSTRIP_SET_LEDS_RGBW:
    case LEDSTRIP_SET_LEDS_RGB_UPDATE:
    case LEDSTRIP_SET_LEDS_RGBW_UPDATE:
      if (!header_received) {
        if (Serial.available() >= color_bytes) {
          Serial.readBytes(ledstrip_msg, color_bytes);
          header_received = 1;
        }
      } else {
        if (Serial.available() >= ledstrip_msg_length * color_bytes) {
          Serial.readBytes(ledstrip + ledstrip_msg_start * color_bytes,
                           ledstrip_msg_length * color_bytes);
          // LEDSTRIP_SET_LEDS_RGB{,W}_UPDATE both have the (1<<1) bit set
          // and LEDSTRIP_SET_LEDS_RGB{,W} do not
          if (type & LEDSTRIP_SET_LEDS_UPDATE_BIT) {
            FastLED.show();
          }
          header_received = 0;
          Serial.write(READY);
          type_received = 0;
        }
      }
      break;
    case LEDSTRIP_FILL_RGB:
    case LEDSTRIP_FILL_RGBW:
      if (Serial.available() >= color_bytes) {
        Serial.readBytes(ledstrip_msg, color_bytes);
        for (u16 i = 0; i < NUM_LEDS; i++) {
          memcpy(ledstrip + i * color_bytes, ledstrip_msg, color_bytes);
        }
        FastLED.show();
        Serial.write(READY);
        type_received = 0;
      }
      break;
    case DISPLAY_WRITE:
      if (Serial.available() >= 4) {
#ifdef ENABLE_DISPLAY
        Serial.readBytes(disps, 4);
#else
        serial_trash_bytes(4);
#endif
        Serial.write(READY);
        type_received = 0;
      }
      break;
    default:
      Serial.write(READY);
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
