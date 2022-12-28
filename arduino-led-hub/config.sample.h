// compiles code needed for the multiplexed display. comment out to disable
#define ENABLE_DISPLAY
// use an RGBW ledstrip instead of RGB. uncomment to enable
// #define RGBW

// data rate of the serial port
// make sure to have the exact same rate on the host
#define BAUD_RATE 9600

// === ledstrip settings === //

// arduino pin of the ledstrip's data pin (or 'Data in', 'Din' etc, usually the green wire)
#define LEDSTRIP_PIN 10

// amount of leds on the strip
#define NUM_LEDS 55

// fade the first 50 leds from 0% to 25% brightness when the arduino starts
// comment out to disable
#define FADE_IN_ON_BOOT

// === display settings === //

// number of displays
#define DISPLAYS 4

// multiplex frequency
#define DISPLAY_MULTIPLEX_FREQUENCY 120

// pin numbers of ground pins, from left to right
static constexpr u8 displayPins[DISPLAYS] = {5, A3, 6, A2};

// pin numbers of positive pins for the segments a to g and the decimal separator
static constexpr u8 segmentPins[8] = {A0, 8, 2, 4, A4, A1, 7, 3};
