/*
 * Copyright (c) 2022 Antoni Spaanderman
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

const LEDSTRIP_SET_LED_RGB = 1;
const LEDSTRIP_SET_LED_RGBW = 4;
const LEDSTRIP_SET_LEDS_RGB = 6;
const LEDSTRIP_SET_LEDS_RGBW = 7;

export function setLedRGBMsg(n: number, r: number, g: number, b: number): Buffer {
  const msg = Buffer.allocUnsafe(6);
  msg.writeUint8(LEDSTRIP_SET_LED_RGB, 0);
  msg.writeUint16LE(n, 1);
  msg.writeUint8(g, 3);
  msg.writeUint8(r, 4);
  msg.writeUint8(b, 5);
  return msg;
}

export function setLedRGBWMsg(n: number, r: number, g: number, b: number, w: number): Buffer {
  const msg = Buffer.allocUnsafe(7);
  msg.writeUint8(LEDSTRIP_SET_LED_RGBW, 0);
  msg.writeUint16LE(n, 1);
  msg.writeUint8(g, 3);
  msg.writeUint8(r, 4);
  msg.writeUint8(b, 5);
  msg.writeUint8(w, 6);
  return msg;
}

type RGB = { r: number, g: number, b: number };
type RGBW = RGB & { w: number };

export function setLedsRGBMsgs(start: number, data: RGB[]): Buffer[] {
  const msgs: Buffer[] = [];
  let msg = Buffer.allocUnsafe(63);
  msg.writeUint8(LEDSTRIP_SET_LEDS_RGB, 0);
  msg.writeUint16LE(start, 1);
  msg.writeUint8(data.length, 3);
  let p = 4;
  for (const d of data) {
    if (p + 3 > 63) {
      msgs.push(msg.subarray(0, p));
      msg = Buffer.allocUnsafe(63);
      p = 0;
    }
    msg.writeUint8(d.g, p++);
    msg.writeUint8(d.r, p++);
    msg.writeUint8(d.b, p++);
  }
  msgs.push(msg.subarray(0, p));
  return msgs;
}

export function setLedsRGBWMsgs(start: number, data: RGBW[]): Buffer[] {
  const msgs: Buffer[] = [];
  let msg = Buffer.allocUnsafe(63);
  msg.writeUint8(LEDSTRIP_SET_LEDS_RGBW, 0);
  msg.writeUint16LE(start, 1);
  msg.writeUint8(data.length, 3);
  let p = 4;
  for (const d of data) {
    if (p + 4 > 63) {
      msgs.push(msg.subarray(0, p));
      msg = Buffer.allocUnsafe(63);
      p = 0;
    }
    msg.writeUint8(d.g, p++);
    msg.writeUint8(d.r, p++);
    msg.writeUint8(d.b, p++);
    msg.writeUint8(d.w, p++);
  }
  msgs.push(msg.subarray(0, p));
  return msgs;
}
