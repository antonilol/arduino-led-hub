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

import { createServer } from 'http';
import { URL } from 'url';
import { config } from '../config';
import type { Server } from '.';
import * as ledstrip from '../devices/ledstrip';
import { sendBytes } from '../serial';

const port = config.http?.socket || 3000;

const server = createServer((req, res) => {
  const url = new URL(`http://localhost/${req.url}`);
  const args = url.pathname.split('/').filter(x => x.trim());
  /** already uri decoded */
  const params = Object.fromEntries(url.searchParams.entries());
  try {
    if (args.length === 1) {
      if (args[0] === 'setLedRGB' || args[0] === 'setLedRGBW') {
        const rgbw = args[0] === 'setLedRGBW';
        if ('n' in params && 'r' in params && 'g' in params && 'b' in params && (!rgbw || 'w' in params)) {
          let msg: Buffer;
          if (rgbw) {
            msg = ledstrip.setLedRGBWMsg(parseInt(params.n), parseInt(params.r), parseInt(params.g), parseInt(params.b), parseInt(params.w));
          } else {
            msg = ledstrip.setLedRGBMsg(parseInt(params.n), parseInt(params.r), parseInt(params.g), parseInt(params.b));
          }
          res.writeHead(200);
          res.write(`Success\n`);
          if ('block' in params) {
            sendBytes(msg, () => res.end());
          } else {
            sendBytes(msg);
            res.end();
          }
          return;
        } else {
          res.writeHead(400);
          res.end(`Missing arguments in query string. Required args: n, r, g, b${rgbw ? ', w' : ''}\n`);
          return;
        }
      } else if (args[0] === 'fillRGB' || args[0] === 'fillRGBW') {
        const rgbw = args[0] === 'fillRGBW';
        if ('r' in params && 'g' in params && 'b' in params && (!rgbw || 'w' in params)) {
          let msg: Buffer;
          if (rgbw) {
            msg = ledstrip.fillRGBWMsg(parseInt(params.r), parseInt(params.g), parseInt(params.b), parseInt(params.w));
          } else {
            msg = ledstrip.fillRGBMsg(parseInt(params.r), parseInt(params.g), parseInt(params.b));
          }
          res.writeHead(200);
          res.write(`Success\n`);
          if ('block' in params) {
            sendBytes(msg, () => res.end());
          } else {
            sendBytes(msg);
            res.end();
          }
          return;
        } else {
          res.writeHead(400);
          res.end(`Missing arguments in query string. Required args: r, g, b${rgbw ? ', w' : ''}\n`);
          return;
        }
      } else if (args[0] === 'setLedsRGB' || args[0] === 'setLedsRGBW') {
        const rgbw = args[0] === 'setLedsRGBW';
        if ('start' in params && 'data' in params) {
          const data = JSON.parse(params.data);
          if (!Array.isArray(data)) {
            res.writeHead(400);
            res.end(`Query string parameter data must be an array\n`);
            return;
          }
          for (let i = 0; i < data.length; i++) {
            if (!('r' in data[i] && 'g' in data[i] && 'b' in data[i] && (!rgbw || 'w' in data[i]))) {
              res.writeHead(400);
              res.end(`Missing arguments in query string parameter data[${i}]. Required args: r, g, b${rgbw ? ', w' : ''}\n`);
              return;
            }
          }
          let msgs: Buffer[];
          if (rgbw) {
            msgs = ledstrip.setLedsRGBWMsgs(parseInt(params.start), data);
          } else {
            msgs = ledstrip.setLedsRGBMsgs(parseInt(params.start), data);
          }
          res.writeHead(200);
          res.write(`Success\n`);
          if ('block' in params) {
            sendBytes(msgs, () => res.end());
          } else {
            sendBytes(msgs);
            res.end();
          }
          return;
        } else {
          res.writeHead(400);
          res.end(`Missing arguments in query string. Required args: start, data\n`);
          return;
        }
      } else if (args[0] == 'raw') {
        if ('data' in params) {
          const data = JSON.parse(params.data);
          if (!Array.isArray(data)) {
            res.writeHead(400);
            res.end(`Query string parameter data must be an array\n`);
            return;
          }
          const msg = Buffer.from(data);
          res.writeHead(200);
          res.write(`Success\n`);
          if ('block' in params) {
            sendBytes(msg, () => res.end());
          } else {
            sendBytes(msg);
            res.end();
          }
          return;
        } else {
          res.writeHead(400);
          res.end(`Missing arguments in query string. Required args: start, data\n`);
          return;
        }
      }
    }
    res.writeHead(404);
    res.end('Not Found\n');
  } catch (e) {
    res.writeHead(400);
    res.end(`${(e instanceof Error ? e.message : e)}\n`);
    return;
  }
});

export class HttpServer implements Server {
  start() {
    server.listen(port);
  }
}
