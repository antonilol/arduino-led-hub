import config, { ledstripConfig } from '../src/config';
import { writeFileSync, existsSync } from 'fs';

if (!existsSync('arduino-led-hub/config.h')) {
	// TODO remove this along with the old config
	writeFileSync('arduino-led-hub/config.h', '');
}

const target = 'arduino-led-hub/generated-config.h';
let content = `// Generated file
// Edit config.json and run "npm run generate_config" to regenerate this file
`;

function define(macro: string, value: number | string, comment?: string): void {
	content += '\n';
	if (comment) {
		content += `// ${comment}\n`;
	}
	content += `#define ${macro} ${value.toString().replaceAll('\n', ' \\\n')}\n`;
}

define('BAUD_RATE', config.hardware.baud_rate, 'config.hardware.baud_rate');

const addLedsCalls: string[] = [];
for (const s of ledstripConfig.ledstrips) {
	addLedsCalls.push(
		`FastLED.addLeds<WS2812, ${s.pin}, RGB>((CRGB *)(ledstrip + ${s.offset}), ${s.paddedByteLength / 3});`
	);
}
define('ADD_LEDS', addLedsCalls.join('\n'), 'run FastLED.addLeds for each led strip');
define('LEDSTRIP_BUFFER_LENGTH', ledstripConfig.totalPaddedByteLength);

define(
	'MAX_SERIAL_MESSAGE_LENGTH',
	config.hardware.max_serial_message_length,
	'used to check that incoming messages will not overflow the serial buffer'
);

writeFileSync(target, content);
