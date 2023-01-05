import config from '../config';
import HttpServer from './http';

export interface Server {
	start(): void;
}

export const availableServers: Readonly<{ [name in typeof config.servers[number]]: new (cfg: typeof config[name]) => Server }> = Object.freeze({
	http: HttpServer
});

export function initServers() {
	for (const s of config.servers) {
		new availableServers[s](config[s]).start();
	}
}
