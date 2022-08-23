/*
 * Copyright (c) 2021 - 2022 Antoni Spaanderman
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// compiles code needed for the ledstrip. comment out to disable
#define ENABLE_LEDSTRIP
// compiles code needed for the multiplexed display. comment out to disable
#define ENABLE_DISPLAY
// use an RGBW ledstrip instead of RGB. uncomment to enable
// #define RGBW

// make sure to have the exact same rate on the host
#define BAUD_RATE 9600

#ifdef ENABLE_LEDSTRIP
#include <FastLED.h>
#endif

#define u8 uint8_t
#define u16 uint16_t

#define serial_trash_bytes(n) for (u8 i = 0; i < n; i++){ Serial.read(); }

// message types
// type is always 1 byte, followed by a certain amount of data (type specific)
// undefined types can be assumed to have 0 bytes of data and ignored
// (arduino) means this message is sent from the arduino to the host
// all other messages are sent from the host to the arduino

// 4 bytes, memcpy to u8 *display
#define DISPLAY_WRITE 0
// 5 bytes, 2 bytes u16 (le) led number, g, r, b
// calls FastLED.show()
#define LEDSTRIP_SET_LED_RGB 1
// 0 bytes, clears
#define LEDSTRIP_CLEAR 2
// 0 bytse, sent when ready to receive once on startup (arduino)
#define CONNECTED 3
// 6 bytes, 2 bytes u16 (le) led number, g, r, b, w
// calls FastLED.show()
#define LEDSTRIP_SET_LED_RGBW 4
// 0 bytes, sent when ready to receive after msg (arduino)
#define MSG_RECVD 5
// 3+3n bytes, 2 bytes u16 (le) led number, 1 byte length n, n times g, r, b
// calls FastLED.show()
#define LEDSTRIP_SET_LEDS_RGB 6
// 3+4n bytes, 2 bytes u16 (le) led number, 1 byte length n, n times g, r, b, w
// calls FastLED.show()
#define LEDSTRIP_SET_LEDS_RGBW 7

// display settings
#define freq 120
// too low frequency will cause delayMicroseconds to be overflowed
// for frequencies lower than 15.2597 Hz, uncomment the following line             1000000 / 16383 / DISPLAYS = 15.2597
#define MICROTIME

// number of displays
#define DISPLAYS 4

// ledstrip settings
#define LEDSTRIP_PIN 10
#define NUM_LEDS (9 + 16 + 9 + 16 + 5)

#ifdef ENABLE_DISPLAY
// pin numbers of negative (ground) pins
const u8 displayPins[DISPLAYS] = {5, A3, 6, A2}; // 5=the most left display, A2=the most right one

// pin numbers of positive pins of segments
const u8 segmentPins[8] = {A0, 8, 2, 4, A4, A1, 7, 3}; // a-g, dp

u8 disps[DISPLAYS] = {0};
#endif

#ifdef RGBW
#define LED_BYTES 4
#define FASTLED_NUM_LEDS ((NUM_LEDS * 4) / 3 + (NUM_LEDS * 4 % 3 != 0))
#else
#define LED_BYTES 3
#define FASTLED_NUM_LEDS NUM_LEDS
#endif

#ifdef ENABLE_LEDSTRIP
u8 ledstrip[NUM_LEDS][LED_BYTES];
#endif

void setup() {
#ifdef ENABLE_LEDSTRIP
  FastLED.addLeds<WS2812, LEDSTRIP_PIN, RGB>((CRGB *) ledstrip, FASTLED_NUM_LEDS);
#endif

  Serial.begin(BAUD_RATE);

  Serial.write(CONNECTED);

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
}

bool tr = 0; // type received
bool incomplete = 0; // data bytes are not completely read because they were unavailable
u8 t;
u8 ledstrip_msg[3];
// points to the led number in a received message
#define LED_N_POINTER ((u16 *) (ledstrip_msg))
// only for SET_LEDS_RGB{,W}
// points to the amount of leds in a received message
#define LED_L_POINTER (ledstrip_msg + 2)
u8 sent;
bool waiting = 0;

void loop() {
  // read serial
  if (!tr) {
    if (Serial.available() >= 1) {
      Serial.readBytes(&t, 1);
      tr = 1;
    }
  }
  if (tr) {
#ifdef ENABLE_DISPLAY
    if (t == DISPLAY_WRITE) {
      if (Serial.available() >= 4) {
        Serial.readBytes(disps, 4);
        Serial.write(MSG_RECVD);
        tr = 0;
      }
    } else
#endif
#ifdef ENABLE_LEDSTRIP
    if (t == LEDSTRIP_SET_LED_RGB) {
      if (Serial.available() >= 5) {
        Serial.readBytes(ledstrip_msg, 2);
        if (*LED_N_POINTER < NUM_LEDS) {
          Serial.readBytes((u8 *) (ledstrip + *LED_N_POINTER), 3);
          FastLED.show();
        }
        Serial.write(MSG_RECVD);
        tr = 0;
      }
    } else if (t == LEDSTRIP_CLEAR) {
      memset(ledstrip, 0x00, sizeof(CRGB) * NUM_LEDS);
      FastLED.show();
      Serial.write(MSG_RECVD);
      tr = 0;
    } else if (t == LEDSTRIP_SET_LED_RGBW) {
      if (Serial.available() >= 6) {
        serial_trash_bytes(6);
        // unimplemented
        Serial.write(MSG_RECVD);
        tr = 0;
      }
    } else if (t == LEDSTRIP_SET_LEDS_RGB) {
      if (Serial.available() >= 3) {
        if (!incomplete) {
          Serial.readBytes(ledstrip_msg, 3);
          sent = 0;
        }
        while (1) {
          if (*LED_L_POINTER == 0) {
            incomplete = 0;
            FastLED.show();
            Serial.write(MSG_RECVD);
            tr = 0;
            break;
          }
          if (Serial.available() < 3) {
            incomplete = 1;
            if (!waiting && (sent % 21 == 19)) {
              Serial.write(MSG_RECVD);
              waiting = 1;
            }
            break;
          }
          if (*LED_N_POINTER < NUM_LEDS) {
            Serial.readBytes((u8 *) (ledstrip + *LED_N_POINTER), 3);
          } else {
            serial_trash_bytes(3);
          }
          (*LED_N_POINTER)++;
          (*LED_L_POINTER)--;
          sent++;
          waiting = 0;
        }
      }
    } else if (t == LEDSTRIP_SET_LEDS_RGBW) {
      if (Serial.available() >= 3) {
        if (!incomplete) {
          Serial.readBytes(ledstrip_msg, 3);
          sent = 0;
        }
        while (1) {
          if (*LED_L_POINTER == 0) {
            incomplete = 0;
            FastLED.show();
            Serial.write(MSG_RECVD);
            tr = 0;
            break;
          }
          if (Serial.available() < 4) {
            incomplete = 1;
            if (!waiting && (sent % 15 == 14)) {
              Serial.write(MSG_RECVD);
              waiting = 1;
            }
            break;
          }
          if (*LED_N_POINTER < NUM_LEDS) {
            Serial.readBytes((u8 *) (ledstrip + *LED_N_POINTER), 4);
          } else {
            serial_trash_bytes(4);
          }
          (*LED_N_POINTER)++;
          (*LED_L_POINTER)--;
          sent++;
          waiting = 0;
        }
      }
    } else
#endif
    {
      Serial.write(MSG_RECVD);
      tr = 0;
    }
  }

#ifdef ENABLE_DISPLAY
  // update displays
  for (u8 i = 0; i < DISPLAYS; i++) {
    digitalWrite(displayPins[i], 0);
    for (u8 j = 0; j < 8; j++) {
      if (disps[i] & (1 << j)) {
        digitalWrite(segmentPins[j], 1);
      }
    }
#ifdef MICROTIME
    delayMicroseconds(1000000 / freq / DISPLAYS);
#else
    delay(1000 / freq / w);
#endif
    for (u8 j = 0; j < 8; j++) {
      digitalWrite(segmentPins[j], 0);
    }
    digitalWrite(displayPins[i], 1);
  }
#endif
}
