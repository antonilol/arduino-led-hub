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

type RequestListener<R extends string = string, O extends string = string> = (
	params: { [k in R]: string } & { [k in O]?: string }
) => string | void | Promise<string | void>;

export default class implements Server {
	private started = false;
	private socket: string | number;
	private requestListeners: { [name: string]: RequestListener } = {};

	constructor(cfg?: typeof config['http']) {
		this.socket = cfg?.socket || 3000;

		this.registerRequestListener('setLed', [ 'name', 'index', 'color' ], [], async params => {
			const color = util.objMap(JSON.parse(params.color), Number);
			await ledstrip.setLed(params.name, parseInt(params.index), color);
		});

		this.registerRequestListener('fillLeds', [ 'name', 'color' ], [ 'start', 'end' ], async params => {
			const color = util.objMap(JSON.parse(params.color), Number);
			await ledstrip.fillLeds(params.name, color, util.parseIntIf(params.start), util.parseIntIf(params.end));
		});

		this.registerRequestListener('setLeds', [ 'name', 'data' ], [ 'start' ], async params => {
			const data = JSON.parse(params.data);
			if (!Array.isArray(data)) {
				throw new Error(`Query string parameter "data" must be an array\n`);
			}
			await ledstrip.setLeds(
				params.name,
				data.map(x => util.objMap(x, Number)),
				util.parseIntIf(params.start)
			);
		});

		this.registerRequestListener('displayNumber', [ 'n' ], [ 'maxdecimals' ], async params => {
			await display.updateDisplayFloat(Number(params.n), params.maxdecimals ? parseInt(params.maxdecimals) : 4);
		});
	}

	start() {
		if (this.started) {
			return;
		}
		this.started = true;
		const server = createServer((req, res) => this.requestListener(req, res));
		if (typeof this.socket === 'string' && /:\d+/.test(this.socket)) {
			const parts = this.socket.split(':');
			const port = parseInt(parts.pop()!);
			server.listen(port, parts.join(':'), () => this.listeningListener());
		} else {
			server.listen(this.socket, () => this.listeningListener());
		}
	}

	registerRequestListener<R extends string, O extends string>(
		name: string,
		requiredParams: readonly R[],
		optionalParams: readonly O[],
		listener: RequestListener<R, O>
	) {
		if (name in this.requestListeners) {
			throw new Error(`Name "${name}" already in use`);
		}
		this.requestListeners[name] = params => {
			checkParams(params, requiredParams, optionalParams);
			return listener(params);
		};
	}

	private listeningListener() {
		console.log(`HTTP server listening on ${this.socket}`);
	}

	private async requestListener(req: IncomingMessage, res: ServerResponse) {
		try {
			const url = new URL(`http://localhost/${req.url}`);
			const args = url.pathname.split('/').filter(x => x.trim());
			const params = readParams(url.searchParams);
			if (args.length === 0) {
				res.writeHead(200);
				res.end(readFileSync('index.html'));
			} else if (args.length === 1) {
				if (args[0] in this.requestListeners) {
					const ret = (await this.requestListeners[args[0]](params)) || 'Success';
					res.writeHead(200);
					res.end(`${ret}\n`);
				} else {
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
