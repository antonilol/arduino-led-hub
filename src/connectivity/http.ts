import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL, URLSearchParams } from 'url';
import { Server } from '.';
import * as ledstrip from '../devices/ledstrip';
import { sendBytes } from '../serial';
import { join } from '../util';

function readParams(searchParams: URLSearchParams): { [k: string]: string } {
	const params: { [k: string]: string } = {};

	for (const [ k, v ] of searchParams.entries()) {
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
	params: { [k: string]: string },
	requiredParams: readonly R[],
	optionalParams: readonly O[],
	extra?: string
): asserts params is { [k in R]: string } & { [k in O]?: string } {
	const missing = requiredParams.filter(p => !(p in params));
	const useless = Object.keys(params).filter(p => !requiredParams.includes(p as R) && !optionalParams.includes(p as O));

	if (missing.length) {
		throw new Error(
			`Missing required query string parameter${missing.length === 1 ? '' : 's'} ${join(missing.map(p => `"${p}"`))}${
				extra ? ` ${extra}` : ''
			}`
		);
	} else if (useless.length) {
		throw new Error(
			`Useless query string parameter${useless.length === 1 ? '' : 's'} ${join(useless.map(p => `"${p}"`))}${
				extra ? ` ${extra}` : ''
			}`
		);
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

export default class HttpServer implements Server {
	private socket: string | number;

	constructor(cfg?: { socket: string | number }) {
		this.socket = cfg?.socket || 3000;
	}

	start() {
		createServer(this.requestListener).listen(this.socket);
		console.log(`http server listening op port ${this.socket}`);
	}

	requestListener(req: IncomingMessage, res: ServerResponse) {
		try {
			const url = new URL(`http://localhost/${req.url}`);
			const args = url.pathname.split('/').filter(x => x.trim());
			const params = readParams(url.searchParams);
			if (args.length === 1) {
				switch (args[0]) {
					case 'setLedRGB':
					case 'setLedRGBW': {
						const rgbw = args[0] === 'setLedRGBW';
						checkParams(params, rgbw ? [ 'n', 'r', 'g', 'b', 'w' ] : [ 'n', 'r', 'g', 'b' ], [ 'block' ]);
						let msg: Buffer;
						if (rgbw) {
							msg = ledstrip.setLedRGBWMsg(
								parseInt(params.n),
								parseInt(params.r),
								parseInt(params.g),
								parseInt(params.b),
								parseInt(params.w)
							);
						} else {
							msg = ledstrip.setLedRGBMsg(
								parseInt(params.n),
								parseInt(params.r),
								parseInt(params.g),
								parseInt(params.b)
							);
						}
						successAndSend(res, msg, params.block !== undefined);
						break;
					}
					case 'fillRGB':
					case 'fillRGBW': {
						const rgbw = args[0] === 'fillRGBW';
						checkParams(params, rgbw ? [ 'r', 'g', 'b', 'w' ] : [ 'r', 'g', 'b' ], [ 'block' ]);
						let msg: Buffer;
						if (rgbw) {
							msg = ledstrip.fillRGBWMsg(
								parseInt(params.r),
								parseInt(params.g),
								parseInt(params.b),
								parseInt(params.w)
							);
						} else {
							msg = ledstrip.fillRGBMsg(parseInt(params.r), parseInt(params.g), parseInt(params.b));
						}
						successAndSend(res, msg, params.block !== undefined);
						break;
					}
					case 'setLedsRGB':
					case 'setLedsRGBW': {
						const rgbw = args[0] === 'setLedsRGBW';
						checkParams(params, [ 'data' ], [ 'start', 'block' ]);
						const data = JSON.parse(params.data);
						if (!Array.isArray(data)) {
							throw new Error(`Query string parameter "data" must be an array\n`);
						}
						for (let i = 0; i < data.length; i++) {
							checkParams(data[i], rgbw ? [ 'r', 'g', 'b', 'w' ] : [ 'r', 'g', 'b' ], [], `in data[${i}]`);
						}
						let msgs: Buffer[];
						const start = params.start === undefined ? 0 : parseInt(params.start);
						if (rgbw) {
							msgs = ledstrip.setLedsRGBWMsgs(start, data);
						} else {
							msgs = ledstrip.setLedsRGBMsgs(start, data);
						}
						successAndSend(res, msgs, params.block !== undefined);
						break;
					}
					default:
						res.writeHead(404);
						res.end('Not Found\n');
				}
			} else {
				res.writeHead(404);
				res.end('Not Found\n');
			}
		} catch (e) {
			res.writeHead(400);
			res.end(`${e instanceof Error ? e.message : e}\n`);
			return;
		}
	}
}
