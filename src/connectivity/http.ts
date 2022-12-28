import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL, URLSearchParams } from 'url';
import { Server } from '.';
import { ledstrip, display } from '../devices';
import { queueSerialMessage } from '../serial';
import { join } from '../util';
import { readFileSync } from 'fs';
import config from '../config';

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

export default class HttpServer implements Server {
	private socket: string | number;

	constructor(cfg?: typeof config['http']) {
		this.socket = cfg?.socket || 3000;
	}

	start() {
		const server = createServer((req, res) => this.requestListener(req, res));
		if (typeof this.socket === 'string' && /:\d+/.test(this.socket)) {
			const parts = this.socket.split(':');
			const port = parseInt(parts.pop()!);
			server.listen(port, parts.join(':'), () => this.listeningListener());
		} else {
			server.listen(this.socket, () => this.listeningListener());
		}
	}

	listeningListener() {
		console.log(`http server listening on ${this.socket}`);
	}

	async requestListener(req: IncomingMessage, res: ServerResponse) {
		try {
			const url = new URL(`http://localhost/${req.url}`);
			const args = url.pathname.split('/').filter(x => x.trim());
			const params = readParams(url.searchParams);
			if (args.length === 0) {
				res.writeHead(200);
				res.end(readFileSync('index.html'));
			} else if (args.length === 1) {
				switch (args[0]) {
					case 'setLedRGB':
					case 'setLedRGBW': {
						const rgbw = args[0] === 'setLedRGBW';
						checkParams(params, rgbw ? [ 'n', 'r', 'g', 'b', 'w' ] : [ 'n', 'r', 'g', 'b' ], []);
						if (rgbw) {
							await ledstrip.setLedRGBW(parseInt(params.n), {
								r: parseInt(params.r),
								g: parseInt(params.g),
								b: parseInt(params.b),
								w: parseInt(params.w)
							});
						} else {
							await ledstrip.setLedRGB(parseInt(params.n), {
								r: parseInt(params.r),
								g: parseInt(params.g),
								b: parseInt(params.b)
							});
						}
						res.writeHead(200);
						res.end(`Success\n`);
						break;
					}
					case 'fillRGB':
					case 'fillRGBW': {
						const rgbw = args[0] === 'fillRGBW';
						checkParams(params, rgbw ? [ 'r', 'g', 'b', 'w' ] : [ 'r', 'g', 'b' ], []);
						if (rgbw) {
							await ledstrip.fillRGBW({
								r: parseInt(params.r),
								g: parseInt(params.g),
								b: parseInt(params.b),
								w: parseInt(params.w)
							});
						} else {
							await ledstrip.fillRGB({ r: parseInt(params.r), g: parseInt(params.g), b: parseInt(params.b) });
						}
						res.writeHead(200);
						res.end(`Success\n`);
						break;
					}
					case 'setLedsRGB':
					case 'setLedsRGBW': {
						const rgbw = args[0] === 'setLedsRGBW';
						checkParams(params, [ 'data' ], [ 'start' ]);
						const data = JSON.parse(params.data);
						if (!Array.isArray(data)) {
							throw new Error(`Query string parameter "data" must be an array\n`);
						}
						for (let i = 0; i < data.length; i++) {
							checkParams(data[i], rgbw ? [ 'r', 'g', 'b', 'w' ] : [ 'r', 'g', 'b' ], [], `in data[${i}]`);
						}
						const start = params.start === undefined ? 0 : parseInt(params.start);
						await ledstrip.setLeds(start, data);
						res.writeHead(200);
						res.end(`Success\n`);
						break;
					}
					case 'displayNumber': {
						checkParams(params, [ 'n' ], [ 'maxdecimals' ]);
						await display.updateDisplayFloat(Number(params.n), params.maxdecimals ? parseInt(params.maxdecimals) : 4);
						res.writeHead(200);
						res.end(`Success\n`);
						break;
					}
					default:
						res.writeHead(404);
						res.end('Not Found\n');
						return;
				}
			} else {
				res.writeHead(404);
				res.end('Not Found\n');
				return;
			}
		} catch (e) {
			res.writeHead(400);
			res.end(`${e instanceof Error ? e.message : e}\n`);
			return;
		}
	}
}
