import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL, URLSearchParams } from 'url';
import { Server } from '.';
import { ledstrip, display } from '../devices';
import * as util from '../util';
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

function checkParams<R extends string, O extends string>(
	params: { [k: string]: string },
	requiredParams: readonly R[],
	optionalParams: readonly O[],
	extra?: string
): asserts params is { [k in R]: string } & { [k in O]?: string } {
	util.checkParams(params, requiredParams, optionalParams, p => `query string parameter${p ? 's' : ''}`, extra);
}

export default class implements Server {
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
		console.log(`HTTP server listening on ${this.socket}`);
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
					case 'setLed': {
						checkParams(params, [ 'name', 'index', 'color' ], []);
						const color = util.objMap(JSON.parse(params.color), Number);
						await ledstrip.setLed(params.name, parseInt(params.index), color);
						res.writeHead(200);
						res.end(`Success\n`);
						break;
					}
					case 'fillLeds': {
						checkParams(params, [ 'name', 'color' ], [ 'start', 'end' ]);
						const color = util.objMap(JSON.parse(params.color), Number);
						await ledstrip.fillLeds(params.name, color, util.parseIntIf(params.start), util.parseIntIf(params.end));
						res.writeHead(200);
						res.end(`Success\n`);
						break;
					}
					case 'setLeds': {
						checkParams(params, [ 'name', 'data' ], [ 'start' ]);
						const data = JSON.parse(params.data);
						if (!Array.isArray(data)) {
							throw new Error(`Query string parameter "data" must be an array\n`);
						}
						await ledstrip.setLeds(
							params.name,
							data.map(x => util.objMap(x, Number)),
							util.parseIntIf(params.start)
						);
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
