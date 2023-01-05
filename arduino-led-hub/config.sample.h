// this config file will be replaced by the generated config
// this is already done for the led strips, not for the display yet

// TODO remove this old config

// compiles code needed for the multiplexed display. comment out to disable
#define ENABLE_DISPLAY

// === ledstrip settings === //

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
