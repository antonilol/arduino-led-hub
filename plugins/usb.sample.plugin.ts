import { spawn } from 'child_process';
import { basename } from 'path';
import { ledstrip } from '../src/devices';
import * as colorutil from '../src/colorutil';

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

const ports: { [port: string]: number | { start: number; length: number } } = {
	'1': 50,
	'3': 51,
	'4': 52,
	'5': { start: 40, length: 4 },
	'7.2': 53,
	'7.1': 54
};

function setPortLed(port: string, color: colorutil.RGB | colorutil.RGBW, update = true): void {
	const led = ports[port];
	if (!led) {
		return;
	}
	const start = typeof led === 'number' ? led : led.start;
	const length = typeof led === 'number' ? 1 : led.length;
	ledstrip.setLeds('monitor_backlight', new Array(length).fill(color), start, update);
}

const portNames = Object.keys(ports);
for (let i = 0; i < portNames.length; i++) {
	setPortLed(portNames[i], { r: 50, g: 0, b: 0 }, i + 1 === portNames.length);
}

watchUSBDevices(update => {
	if (update.action === 'add' || update.action === 'remove') {
		const port = basename(update.data.devpath).slice(2);
		setPortLed(port, update.action === 'add' ? { r: 0, g: 50, b: 0 } : { r: 50, g: 0, b: 0 });
	}
});
