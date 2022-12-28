import { queueSerialMessage } from '../serial';
import msgType from './msgtype';

const arduinoRXBufferSize = 63;
// message header size: 4, bytes per color: 3
const maxRGBPerMsg = Math.floor((arduinoRXBufferSize - 4) / 3);
// message header size: 4, bytes per color: 4
const maxRGBWPerMsg = Math.floor((arduinoRXBufferSize - 4) / 4);

type RGB = { r: number; g: number; b: number };
type RGBW = RGB & { w: number };

export async function setLedRGB(n: number, { r, g, b }: RGB): Promise<void> {
	const msg = Buffer.from([ msgType.SET_LED_RGB, 0, 0, g, r, b ]);
	msg.writeUint16LE(n, 1);
	await queueSerialMessage(msg);
}

export async function setLedRGBW(n: number, { r, g, b, w }: RGBW): Promise<void> {
	const msg = Buffer.from([ msgType.SET_LED_RGBW, 0, 0, g, r, b, w ]);
	msg.writeUint16LE(n, 1);
	await queueSerialMessage(msg);
}

export async function fillRGB({ r, g, b }: RGB): Promise<void> {
	await queueSerialMessage(Buffer.from([ msgType.FILL_RGB, g, r, b ]));
}

export async function fillRGBW({ r, g, b, w }: RGBW): Promise<void> {
	await queueSerialMessage(Buffer.from([ msgType.FILL_RGBW, g, r, b, w ]));
}

function setLedsMsgFrag(start: number, data: RGB[] | RGBW[]): Buffer {
	const rgbw = 'w' in data[0];
	const msg = Buffer.allocUnsafe(4 + (rgbw ? 4 : 3) * data.length);
	msg.writeUint8(rgbw ? msgType.SET_LEDS_RGBW : msgType.SET_LEDS_RGB, 0);
	msg.writeUint16LE(start, 1);
	msg.writeUint8(data.length, 3);
	let p = 4;
	for (const d of data) {
		msg.writeUint8(d.g, p++);
		msg.writeUint8(d.r, p++);
		msg.writeUint8(d.b, p++);
		if (rgbw) {
			msg.writeUint8((d as RGBW).w, p++);
		}
	}
	return msg;
}

export async function setLeds(start: number, data: RGB[] | RGBW[]): Promise<void> {
	const msgs: Buffer[] = [];
	const colorsPerMsg = 'w' in data[0] ? maxRGBWPerMsg : maxRGBPerMsg;
	for (let i = 0; i < data.length; i += colorsPerMsg) {
		msgs.push(setLedsMsgFrag(start + i, data.slice(i, i + colorsPerMsg)));
	}
	await queueSerialMessage(msgs);
}
