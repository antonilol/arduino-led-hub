import * as util from './util';
import { ledstripConfig, LedStrip } from './config';

/** This function will throw an error if `ledstripName` is not valid */
export function serializeColor(
	ledstripName: string,
	color: { [k: string]: number }
): { serializedColor: Buffer; ledstrip: LedStrip } {
	const ledstrip = ledstripConfig.ledstrips.find(x => x.name === ledstripName);
	const colors = ledstrip?.colors;

	if (!colors) {
		throw new Error(`Unknown LED strip "${ledstripName}"`);
	}

	util.checkParams(color, colors, [], p => `color${p ? 's' : ''}`);

	const serializedColor = Buffer.allocUnsafe(colors.length);
	for (let i = 0; i < colors.length; i++) {
		const v = color[colors[i]];
		util.checkUint8(v, colors[i]);
		serializedColor.writeUint8(v, i);
	}

	return { serializedColor, ledstrip };
}

/** Convert HSV to RGB. H: 0-360, S: 0-1, V: 0-1 */
export function HSVtoRGB({ h, s, v }: { h: number; s: number; v: number }): { r: number; g: number; b: number } {
	const i = Math.floor(h / 60);
	const f = h / 60 - i;
	v *= 255;
	const p = Math.round(v * (1 - s));
	const q = Math.round(v * (1 - f * s));
	const t = Math.round(v * (1 - (1 - f) * s));
	v = Math.round(v);

	switch (i % 6) {
		case 0:
			return { r: v, g: t, b: p };
		case 1:
			return { r: q, g: v, b: p };
		case 2:
			return { r: p, g: v, b: t };
		case 3:
			return { r: p, g: q, b: v };
		case 4:
			return { r: t, g: p, b: v };
		default: // case 5:
			return { r: v, g: p, b: q };
	}
}
