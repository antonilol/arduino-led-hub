import * as fs from 'fs';
import { SerialPort } from 'serialport';
import config from '../config';

import { logData, logMessage } from './log';

const dir = '/dev/';
// const devices = /^tty(USB|ACM)\d+$/;
const device = config.serial_port || 'ttyUSB0';
const baudRate = config.hardware.baud_rate || 9600;

let port: undefined | SerialPort;
let portLocked = false;

export function initDevices() {
	fs.readdirSync('/dev/').forEach(filename => {
		tryOpen(filename);
	});

	fs.watch(dir, (_, filename) => {
		tryOpen(filename);
	});
}

const READY = 0;

let ready = false;

const queue: { b: Buffer; callback?: () => void }[] = [];

/** Queue a new message for the serial port. It will be sent as soon as the port is ready.
 * Resolves when the receiver confirms receipt of the message, or the last message of the list.
 * Messages are sent in the order they were queued, first in (queued) first out (sent).
 */
export function queueSerialMessage(b: Buffer | Buffer[]): Promise<void> {
	return new Promise(resolve => {
		if (Array.isArray(b)) {
			for (let i = 0; i < b.length; i++) {
				queue.push({ b: b[i], callback: b.length - 1 === i ? resolve : undefined });
			}
		} else {
			queue.push({ b, callback: resolve });
		}
		trySend();
	});
}

function trySend() {
	if (!ready || !port) {
		return;
	}

	const q = queue.shift();
	if (!q) {
		return;
	}

	logData(device, false, q.b);
	port.write(q.b);
	if (q.callback) {
		q.callback();
	}
	ready = false;
}

function onData(b: Buffer): void {
	logData(device, true, b);
	// for now
	for (let i = 0; i < b.length; i++) {
		if (b[i] === READY) {
			ready = true;
			trySend();
		}
	}
}

async function tryOpen(filename: string): Promise<void> {
	if (filename === device) {
		const path = dir + filename;
		if (!port && !portLocked && fs.existsSync(path)) {
			logMessage(`Opening serial port ${path}`);
			// lock while opening
			portLocked = true;
			port = await new Promise<undefined | SerialPort>(resolve => {
				const p = new SerialPort({ path, baudRate }, err => {
					if (err) {
						console.error(`An unexpected error occurred while opening ${path} at ${baudRate} Bd`);
						console.error(err.message);
						resolve(undefined);
					} else {
						resolve(p);
					}
				});
				p.on('open', () => {
					logMessage(`Serial port ${path} opened`);
				})
					.on('data', (data: Buffer) => {
						onData(data);
					})
					.on('close', () => {
						logMessage(`Serial port ${path} closed`);
						// free to be reopened when reconnected
						port = undefined;
					});
			});
			portLocked = false;
			trySend();
		}
	}
}
