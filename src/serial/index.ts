import * as fs from 'fs';
import { SerialPort } from 'serialport';
import config from '../config';

import { logData, logMessage } from './log';

const dir = '/dev/';
// const devices = /^tty(USB|ACM)\d+$/;
const device = config.serial_port || 'ttyUSB0';
const baudRate = config.baud_rate || 9600;

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

const CONNECTED = 3;
const RECVD = 5;

let ready = false;

const queue: { b: Buffer; onSent?: () => void }[] = [];

export function sendBytes(b: Buffer | Buffer[], onSent?: () => void): void {
	if (Array.isArray(b)) {
		for (let i = 0; i < b.length; i++) {
			queue.push({ b: b[i], onSent: b.length - 1 === i ? onSent : undefined });
		}
	} else {
		queue.push({ b, onSent });
	}
	trySend();
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
	if (q.onSent) {
		q.onSent();
	}
	ready = false;
}

function onData(b: Buffer): void {
	logData(device, true, b);
	// for now
	for (let i = 0; i < b.length; i++) {
		if (b[i] === CONNECTED || b[i] === RECVD) {
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
