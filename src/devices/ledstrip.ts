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

export function setLedsRGBMsgs(start: number, data: RGB[]): Buffer[] {
	const msgs: Buffer[] = [];
	let msg = Buffer.allocUnsafe(63);
	msg.writeUint8(msgType.SET_LEDS_RGB, 0);
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
	msg.writeUint8(msgType.SET_LEDS_RGBW, 0);
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
