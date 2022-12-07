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

import { createServer, ServerResponse } from 'http';
import { URL, URLSearchParams } from 'url';
import { config } from '../config';
import type { Server } from '.';
import * as ledstrip from '../devices/ledstrip';
import { sendBytes } from '../serial';
import { join } from '../util';

function readParams(searchParams: URLSearchParams): { [k: string]: string } {
  const params: { [k: string]: string } = {};

  for (const [k, v] of searchParams.entries()) {
    if (params[k] !== undefined) {
      throw new Error(`Duplicate parameter ${k}`);
    }
    params[k] = v;
  }

  return params;
}

/** Does more than only checking, it also sends a nice error message
 * Returns true if no params are missing and none are useless
 */
function checkParams<R extends string, O extends string>(
  res: ServerResponse,
  params: { [k: string]: string },
  requiredParams: readonly R[],
  optionalParams: readonly O[],
  extra?: string
): asserts params is ({ [k in R]: string } & { [k in O]?: string }) {
  const missing = requiredParams.filter(p => !(p in params));
  const useless = Object.keys(params).filter(p => !requiredParams.includes(p as R) && !optionalParams.includes(p as O));

  if (missing.length) {
    throw new Error(`Missing required query string parameter${missing.length === 1 ? '' : 's'} ${join(missing.map(p => `"${p}"`))}${extra ? ` ${extra}` : ''}`);
  } else if (useless.length) {
    throw new Error(`Useless query string parameter${useless.length === 1 ? '' : 's'} ${join(useless.map(p => `"${p}"`))}${extra ? ` ${extra}` : ''}`);
  }
}

function successAndSend(res: ServerResponse, msg: Buffer | Buffer[], block: boolean): void {
  res.writeHead(200);
  res.write(`Success\n`);

  if (block) {
    sendBytes(msg, () => res.end());
  } else {
    sendBytes(msg);
    res.end();
  }
}

const port = config.http?.socket || 3000;

const server = createServer((req, res) => {
  try {
    const url = new URL(`http://localhost/${req.url}`);
    const args = url.pathname.split('/').filter(x => x.trim());
    const params = readParams(url.searchParams);
    if (args.length === 1) {
      if (args[0] === 'setLedRGB' || args[0] === 'setLedRGBW') {
        const rgbw = args[0] === 'setLedRGBW';
        checkParams(res, params, rgbw ? ['n', 'r', 'g', 'b', 'w'] : ['n', 'r', 'g', 'b'], ['block']);
        let msg: Buffer;
        if (rgbw) {
          msg = ledstrip.setLedRGBWMsg(parseInt(params.n), parseInt(params.r), parseInt(params.g), parseInt(params.b), parseInt(params.w));
        } else {
          msg = ledstrip.setLedRGBMsg(parseInt(params.n), parseInt(params.r), parseInt(params.g), parseInt(params.b));
        }
        successAndSend(res, msg, params.block !== undefined);
      } else if (args[0] === 'fillRGB' || args[0] === 'fillRGBW') {
        const rgbw = args[0] === 'fillRGBW';
        checkParams(res, params, rgbw ? ['r', 'g', 'b', 'w'] : ['r', 'g', 'b'], ['block']);
        let msg: Buffer;
        if (rgbw) {
          msg = ledstrip.fillRGBWMsg(parseInt(params.r), parseInt(params.g), parseInt(params.b), parseInt(params.w));
        } else {
          msg = ledstrip.fillRGBMsg(parseInt(params.r), parseInt(params.g), parseInt(params.b));
        }
        successAndSend(res, msg, params.block !== undefined);
      } else if (args[0] === 'setLedsRGB' || args[0] === 'setLedsRGBW') {
        const rgbw = args[0] === 'setLedsRGBW';
        checkParams(res, params, ['data'], ['start', 'block']);
        const data = JSON.parse(params.data);
        if (!Array.isArray(data)) {
          throw new Error(`Query string parameter "data" must be an array\n`);
        }
        for (let i = 0; i < data.length; i++) {
          checkParams(res, data[i], rgbw ? ['r', 'g', 'b', 'w'] : ['r', 'g', 'b'], [], `in data[${i}]`);
        }
        let msgs: Buffer[];
        const start = params.start === undefined ? 0 : parseInt(params.start);
        if (rgbw) {
          msgs = ledstrip.setLedsRGBWMsgs(start, data);
        } else {
          msgs = ledstrip.setLedsRGBMsgs(start, data);
        }
        successAndSend(res, msgs, params.block !== undefined);
      } else {
        res.writeHead(404);
        res.end('Not Found\n');
      }
    } else {
      res.writeHead(404);
      res.end('Not Found\n');
    }
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
