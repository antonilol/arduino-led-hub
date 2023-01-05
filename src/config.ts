import { readFileSync } from 'fs';
import { ceil3 } from './util';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Config {
	serial_port: string;
	hardware: {
		baud_rate: number;
		max_serial_message_length: number;
		ledstrips: {
			name: string;
			length: number;
			pin: number | string;
			type: string;
		}[];
	};
	debug_serial_msgs: boolean;
	servers: 'http'[]; // TODO 'ws' | 'grpc'
	http?: {
		socket: string | number;
	};
	plugins: string[];
}

function mergeConfig(user: any, def: any, value = 'config'): Config {
	const res: any = {};

	for (const k in def) {
		const v = `${value}[${JSON.stringify(k)}]`;
		if (typeof def[k] === 'object' && !Array.isArray(def[k])) {
			res[k] = mergeConfig(user[k], def[k], v);
		} else if (user === undefined || user[k] === undefined) {
			res[k] = def[k];
			console.log(`Warning: ${v} unset, defaulting to ${JSON.stringify(def[k])}`);
		} else {
			res[k] = user[k];
		}
	}

	return res;
}

const userConfig = JSON.parse(readFileSync('config.json').toString());
const exampleConfig = JSON.parse(readFileSync('config.sample.json').toString());

const config = Object.freeze(mergeConfig(userConfig, exampleConfig));
export default config;

if (config.hardware.max_serial_message_length >= 256) {
	throw new Error(
		`Unsupported config.hardware.max_serial_message_length ${config.hardware.max_serial_message_length} (too high)`
	);
}

let totalPackedByteLength = 0;
let totalPaddedByteLength = 0;
const ledstrips = config.hardware.ledstrips.map(s => {
	const offset = totalPackedByteLength;
	const packedByteLength = s.type.length * s.length;
	const paddedByteLength = ceil3(packedByteLength);
	totalPaddedByteLength = Math.max(totalPaddedByteLength, totalPackedByteLength + paddedByteLength);
	totalPackedByteLength += packedByteLength;
	const colors = s.type
		.toLowerCase()
		.split('')
		.map((c, i, l) => {
			const count = l.filter(x => x === c).length;
			const index = l.slice(0, i + 1).filter(x => x === c).length;
			return c + (count === 1 ? '' : index);
		});
	return {
		...s,
		paddedByteLength,
		offset,
		colors
	};
});

export const ledstripConfig = { ledstrips, totalPackedByteLength, totalPaddedByteLength };
export type LedStrip = typeof ledstrips[number];
