import { initServers } from './connectivity';
import { initDevices } from './serial';
import { loadPlugins } from './pluginloader';

loadPlugins();
initDevices();
initServers();
