#include <Arduino.h>
#include <FastLED.h>
#include <limits.h>

#include "config.h"
#include "generated-config.h"

#if SERIAL_RX_BUFFER_SIZE <= MAX_SERIAL_MESSAGE_LENGTH
#error Increase SERIAL_RX_BUFFER_SIZE or decrease config.hardware.max_serial_message_length
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
enum rx_msg_type {
  // 3+n bytes: u16 byte offset, u8 byte length `n`, n bytes
  LEDSTRIP_SET_LEDS = 0x00,
  // LEDSTRIP_SET_LEDS but also updates the led strip
  LEDSTRIP_SET_LEDS_UPDATE = 0x01,
  // 5+n bytes: u16 byte offset, u16 length, u8 bytes per led `n`, n bytes
  // updates the led strip
  LEDSTRIP_FILL_LEDS = 0x02,
  // 4 bytes: memcpy to u8 *display
  DISPLAY_WRITE = 0x03
};

// message types for messages sent from the Arduino to the host
enum tx_msg_type {
  // 0 bytes, sent when ready to receive a msg, also after booting up
  READY = 0x00
};

u8 ledstrip[LEDSTRIP_BUFFER_LENGTH] = {0};

#ifdef ENABLE_DISPLAY
u8 disps[DISPLAYS] = {0};
#endif

void setup() {
  Serial.begin(BAUD_RATE);

  ADD_LEDS
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

// when reading messages where the total length is not known
// before reading the header, the message could be read in 2 parts
// in between the 2 parts `header_received` and `type_received` are true (1)
bool header_received = 0;
u8 ledstrip_msg[5];
// SET_LEDS pointers
#define set_leds_byte_offset (*((u16 *)(ledstrip_msg)))
#define set_leds_byte_length (*((u8 *)(ledstrip_msg + 2)))

// FILL_LEDS pointers
#define fill_leds_byte_offset (*((u16 *)(ledstrip_msg)))
#define fill_leds_length (*((u16 *)(ledstrip_msg + 2)))
#define fill_leds_bytes_per_led (*((u8 *)(ledstrip_msg + 4)))

void loop() {
  if (!type_received) {
    if (Serial.available() >= 1) {
      Serial.readBytes(&type, 1);
      type_received = 1;
    }
  }
  if (type_received) {
    switch (type) {
    case LEDSTRIP_SET_LEDS:
    case LEDSTRIP_SET_LEDS_UPDATE:
      if (!header_received) {
        if (Serial.available() >= 3) {
          Serial.readBytes(ledstrip_msg, 3);
          header_received = 1;
        }
      } else {
        if (Serial.available() >= set_leds_byte_length) {
          Serial.readBytes(ledstrip + set_leds_byte_offset, set_leds_byte_length);
          if (type == LEDSTRIP_SET_LEDS_UPDATE) {
            FastLED.show();
          }
          header_received = 0;
          Serial.write(READY);
          type_received = 0;
        }
      }
      break;
    case LEDSTRIP_FILL_LEDS:
      if (!header_received) {
        if (Serial.available() >= 5) {
          Serial.readBytes(ledstrip_msg, 5);
          header_received = 1;
        }
      } else {
        if (Serial.available() >= fill_leds_bytes_per_led) {
          Serial.readBytes(ledstrip + fill_leds_byte_offset, fill_leds_bytes_per_led);
          for (u16 i = 1; i < fill_leds_length; i++) {
            memcpy(ledstrip + fill_leds_byte_offset + i * fill_leds_bytes_per_led,
                   ledstrip + fill_leds_byte_offset, fill_leds_bytes_per_led);
          }
          FastLED.show();
          header_received = 0;
          Serial.write(READY);
          type_received = 0;
        }
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
