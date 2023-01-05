import config, { ledstripConfig } from '../config';
import { queueSerialMessage } from '../serial';
import msgType from './msgtype';
import * as colorutil from '../colorutil';

export async function setLed(name: string, index: number, color: { [k: string]: number }): Promise<void> {
	return await setLeds(name, [ color ], index);
}

export async function fillLeds(name: string, color: { [k: string]: number }, start = 0, end?: number): Promise<void> {
	const { serializedColor, ledstrip } = colorutil.serializeColor(name, color);
	if (end === undefined) {
		end = ledstrip.length;
	}
	if (start < 0 || start >= ledstrip.length) {
		throw new Error('"start" out of bounds');
	}
	if (end <= 0 || end > ledstrip.length) {
		throw new Error('"end" out of bounds');
	}
	const length = end - start;
	if (length <= 0) {
		throw new Error('"start" must be smaller than "end"');
	}
	const header = Buffer.allocUnsafe(6);
	header.writeUint8(msgType.LEDSTRIP_FILL_LEDS, 0);
	header.writeUint16LE(ledstrip.offset + ledstrip.colors.length * start, 1);
	header.writeUint16LE(length, 3);
	header.writeUint8(ledstrip.colors.length, 5);
	await queueSerialMessage(Buffer.concat([ header, serializedColor ]));
}

export async function setLeds(
	name: string,
	colors: { [k: string]: number }[],
	start = 0,
	update = true
): Promise<void> {
	if (!colors.length) {
		return;
	}
	const msgs: Buffer[] = [];
	let currentBuffer: Buffer;
	let currentPos = 0; // excluding header
	let offset: number;
	for (const color of colors) {
		const { serializedColor, ledstrip } = colorutil.serializeColor(name, color);
		if (!currentBuffer!) {
			offset = ledstrip.offset + ledstrip.colors.length * start;
		}
		if (!currentBuffer! || currentPos + 4 + serializedColor.length > currentBuffer.length) {
			offset! += currentPos;
			if (currentBuffer!) {
				currentBuffer.writeUint8(msgType.LEDSTRIP_SET_LEDS, 0);
				currentBuffer.writeUint8(currentPos, 3);
				msgs.push(currentBuffer.subarray(0, currentPos + 4));
			}
			currentBuffer = Buffer.allocUnsafe(config.hardware.max_serial_message_length);
			currentBuffer.writeUint16LE(offset!, 1);
			currentPos = 0;
		}
		serializedColor.copy(currentBuffer, currentPos + 4);
		currentPos += serializedColor.length;
	}
	currentBuffer!.writeUint8(update ? msgType.LEDSTRIP_SET_LEDS_UPDATE : msgType.LEDSTRIP_SET_LEDS, 0);
	currentBuffer!.writeUint8(currentPos, 3);
	msgs.push(currentBuffer!.subarray(0, currentPos + 4));
	await queueSerialMessage(msgs);
}
