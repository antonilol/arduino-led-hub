import config from '../config';
import HttpServer from './http';

export interface Server {
	start(): void;
}

const availableServers: { [name in typeof config.servers[number]]: new (cfg: typeof config[name]) => Server } = {
	http: HttpServer
};

export function initServers() {
	for (const s of config.servers) {
		new availableServers[s](config[s]).start();
	}
}
