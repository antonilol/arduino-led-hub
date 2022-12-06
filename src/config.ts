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

import { readFileSync } from 'fs';

interface Config {
  serial_port: string;
  baud_rate: number;
  debug_serial_msgs: boolean;
  servers: ('http')[]; // TODO 'ws' | 'grpc'
  http?: {
    socket: string | number
  };
}

function mergeConfig(user: any, def: any, value = 'config'): any {
  if (Array.isArray(def)) {
    return user || def;
  }

  const res: any = {};

  for (const k in def) {
    const v = `${value}[${JSON.stringify(k)}]`;
    if (typeof def[k] === 'object') {
      res[k] = mergeConfig(user[k], def[k], v);
    } else if (user[k] === undefined) {
      res[k] = def[k];
      console.log(`Warning: ${v} unset, defaulting to ${def[k]}`)
    } else {
      res[k] = user[k];
    }
  }

  return res;
}

const userConfig = JSON.parse(readFileSync('config.json').toString());
const exampleConfig = JSON.parse(readFileSync('example_config.json').toString());

export const config = Object.freeze(mergeConfig(userConfig, exampleConfig) as Config);
