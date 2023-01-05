import { queueSerialMessage } from '../serial';
import msgType from './msgtype';

/** defines if segments a (1<<0) to g (1<<6) are turned on for a number from 0 to 9 (the index)
 * the decimal separator (1<<7) is unused here
 */
const display7seg = [ 63, 6, 91, 79, 102, 109, 125, 7, 127, 111 ];
const decimalSeparator = 1 << 7;

// TODO fix inconsistent rounding
export async function updateDisplayFloat(n: number, maxdecimals: number): Promise<void> {
	const [ intPart, floatPart ] = n.toFixed(maxdecimals).split('.');
	if (intPart.length > 4) {
		throw new Error('Number too long');
	}
	const displayNumber = (intPart + floatPart).slice(0, 4);
	const msg = Buffer.from([ msgType.DISPLAY_WRITE, 0, 0, 0, 0 ]);
	for (let i = 0; i < displayNumber.length; i++) {
		msg[i + 1] = display7seg[parseInt(displayNumber[i])];
	}
	if (intPart.length !== 4 && floatPart) {
		msg[intPart.length] |= decimalSeparator;
	}
	await queueSerialMessage(msg);
}
