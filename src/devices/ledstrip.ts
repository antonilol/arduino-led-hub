const arduinoRXBufferSize = 64;
// message header size: 4, bytes per color: 3
const maxRGBPerMsg = Math.floor((arduinoRXBufferSize - 4) / 3);
// message header size: 4, bytes per color: 4
const maxRGBWPerMsg = Math.floor((arduinoRXBufferSize - 4) / 4);

const msgType = {
	SET_LED_RGB: 1,
	SET_LED_RGBW: 4,
	SET_LEDS_RGB: 6,
	SET_LEDS_RGBW: 7,
	FILL_RGB: 8,
	FILL_RGBW: 9
} as const;

export function setLedRGBMsg(n: number, r: number, g: number, b: number): Buffer {
	const msg = Buffer.from([ msgType.SET_LED_RGB, 0, 0, g, r, b ]);
	msg.writeUint16LE(n, 1);
	return msg;
}

export function setLedRGBWMsg(n: number, r: number, g: number, b: number, w: number): Buffer {
	const msg = Buffer.from([ msgType.SET_LED_RGBW, 0, 0, g, r, b, w ]);
	msg.writeUint16LE(n, 1);
	return msg;
}

export function fillRGBMsg(r: number, g: number, b: number): Buffer {
	return Buffer.from([ msgType.FILL_RGB, g, r, b ]);
}

export function fillRGBWMsg(r: number, g: number, b: number, w: number): Buffer {
	return Buffer.from([ msgType.FILL_RGB, g, r, b, w ]);
}

type RGB = { r: number; g: number; b: number };
type RGBW = RGB & { w: number };

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

export function setLedsMsgs(start: number, data: RGB[] | RGBW[]): Buffer[] {
	const msgs: Buffer[] = [];
	const colorsPerMsg = 'w' in data[0] ? maxRGBWPerMsg : maxRGBPerMsg;
	for (let i = 0; i < data.length; i += colorsPerMsg) {
		msgs.push(setLedsMsgFrag(start + i, data.slice(i, i + colorsPerMsg)));
	}
	return msgs;
}
