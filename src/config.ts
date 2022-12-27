import { readFileSync } from 'fs';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Config {
	serial_port: string;
	baud_rate: number;
	debug_serial_msgs: boolean;
	servers: 'http'[]; // TODO 'ws' | 'grpc'
	http?: {
		socket: string | number;
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
			console.log(`Warning: ${v} unset, defaulting to ${def[k]}`);
		} else {
			res[k] = user[k];
		}
	}

	return res;
}

const userConfig = JSON.parse(readFileSync('config.json').toString());
const exampleConfig = JSON.parse(readFileSync('example_config.json').toString());

const config = Object.freeze(mergeConfig(userConfig, exampleConfig) as Config);
export default config;
