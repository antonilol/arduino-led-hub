import { readdirSync } from 'fs';
import config from './config';
import { join } from './util';

const sourceExtension = '.plugin.ts';
const extension = '.plugin.js';

export async function loadPlugins(): Promise<void> {
	const availablePlugins = readdirSync('plugins')
		.filter(f => f.endsWith(sourceExtension))
		.map(f => f.slice(0, -sourceExtension.length));
	console.log(`Available plugins: ${join(availablePlugins.map(x => `"${x}"`))}`);

	for (const plugin of availablePlugins) {
		if (config.plugins.includes(plugin)) {
			console.log(`Loading ${plugin}`);
			await import(`../plugins/${plugin}${extension}`);
			console.log(`Loaded ${plugin}`);
		}
	}
}
