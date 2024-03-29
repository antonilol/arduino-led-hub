import { spawn } from 'child_process';
import { basename } from 'path';
import { ledstrip } from '../src/devices';

function watchUSBDevices(
	cb: (update: { kernelTimestamp: number; action: string; data: { [k: string]: string } }) => void
) {
	const p = spawn('udevadm', [ 'monitor', '--subsystem-match=usb', '--property', '--udev' ]);
	let out = '';
	let ignore = true;

	p.stdout.setEncoding('utf8');
	p.stdout.on('data', data => {
		out += data.toString();
		const updates = out.split('\n\n');
		out = updates.pop()!;
		for (const update of updates) {
			if (!ignore) {
				const lines = update.split('\n');
				const event = lines.shift()!.split(/ +/);
				cb({
					kernelTimestamp: Number(event[1].slice(1, -1)),
					action: event[2],
					data: Object.fromEntries(
						lines.map(l => {
							const [ k, ...v ] = l.split('=');
							return [ k.toLowerCase(), v.join('=') ];
						})
					)
				});
			}
			ignore = false;
		}
	});
}

const colors = {
	idle: { r: 0, g: 0, b: 30 },
	connected: { r: 0, g: 50, b: 0 }
};

const ports: { [port: string]: number | { start: number; length: number } } = {
	'1': 50,
	'3': 51,
	'4': 52,
	'5': { start: 40, length: 4 },
	'7.2': 53,
	'7.1': 54
};

function setPortLed(port: string, color: { [k: string]: number }, update = true): void {
	const led = ports[port];
	if (!led) {
		return;
	}
	const { start, length } = typeof led === 'number' ? { start: led, length: 1 } : led;
	ledstrip.setLeds('monitor_backlight', new Array(length).fill(color), start, update);
}

const portNames = Object.keys(ports);
for (let i = 0; i < portNames.length; i++) {
	setPortLed(portNames[i], colors.idle, i + 1 === portNames.length);
}

watchUSBDevices(update => {
	if (update.action === 'add' || update.action === 'remove') {
		const port = basename(update.data.devpath).slice(2);
		setPortLed(port, update.action === 'add' ? colors.connected : colors.idle);
	}
});
