import { initServers } from './connectivity';
import { initDevices } from './serial';

console.log('initDevices');
initDevices();
console.log('initServers');
initServers();
console.log('init done');
