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

import { config } from '../config';

const chars = {
	arrowUp: '\u2191',
	arrowDown: '\u2193'
} as const;

function color(...c: number[]) {
	return `\x1b[${c.join(';')}m`;
}

function rgb(r: number, g: number, b: number, bg = false) {
	return color(bg ? 48 : 38, 2, r, g, b);
}

const RESET = color(0);
const BOLD = color(1);
const GRAY = rgb(150, 150, 150);
const DATA_INFO_COLOR = rgb(0, 255, 0);
const MESSAGE_COLOR = rgb(100, 100, 255);

const ROW_LENGTH = 16;

export function logData(device: string, rx: boolean, data: Buffer): void {
	if (!config.debug_serial_msgs) {
		return;
	}

	logTimeDiff();

	const info = [
		rx ? `${chars.arrowDown} rx` : `${chars.arrowUp} tx`,
		device,
		`${' '.repeat(Math.max(0, 3 - data.length.toString().length))}${data.length}`,
		`byte${data.length === 1 ? ' ' : 's'}`
	].join(' ');
	const filler = ' '.repeat(info.length);

	for (let i = 0; i < data.length; i += ROW_LENGTH) {
		console.log((i ? filler : DATA_INFO_COLOR + info + RESET) + '  ' + dataLine(data.subarray(i, i + ROW_LENGTH)));
	}
}

export function logMessage(message: string): void {
	logTimeDiff();

	console.log(MESSAGE_COLOR + BOLD + '(i) ' + RESET + MESSAGE_COLOR + message + RESET);
}

let lastLog: number | undefined;

function logTimeDiff() {
	const now = new Date().getTime();

	if (lastLog) {
		console.log(GRAY + `d = ${now - lastLog}ms` + RESET);
	}

	lastLog = now;
}

function dataLine(line: Buffer): string {
	let hex = '';
	let ascii = '';

	for (let i = 0; i < line.length; i++) {
		const c = line.subarray(i, i + 1);
		hex += c.toString('hex') + ' ';
		if (line[i] > 0x1f && line[i] < 0x7f) {
			ascii += c.toString();
		} else {
			ascii += GRAY + '?' + RESET;
		}
	}

	return hex + '   '.repeat(ROW_LENGTH - line.length) + ' ' + ascii;
}
