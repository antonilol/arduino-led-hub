# Arduino LED hub

## Setup

Copy `config.sample.json` to `config.json` and edit to your needs.

TODO: explain the config file entries here

Install npm dependencies and generate the required config for the arduino:

```
npm install
npm run generate_config
```

Compile and upload arduino-led-hub/arduino-led-hub.ino to your Arduino (with the IDE)

The server can started with

```
npm run start
```

## Testing/usage/troubleshooting

### Sending to a unix socket with `curl`:

```
curl --unix-socket /path/to/socket.sock "localhost/fillLeds?name=monitor_backlight&color=$(node -pe 'encodeURIComponent(JSON.stringify({r:50,g:0,b:0}))')"
```

### EncodeURIComponent and JSON.stringify one-liner with `node -pe`:

Sets the first 50 LEDs of "monitor_backlight" to a gradient from green to blue

```
curl --unix-socket /path/to/socket.sock "localhost/setLeds?name=monitor_backlight&data=$(node -pe 'encodeURIComponent(JSON.stringify(new Array(50).fill().map((_,i)=>({r:0,g:255-i*5,b:i*5}))))')"
```

This evaluates the following JavaScript with `node -pe`:

```js
encodeURIComponent(JSON.stringify(new Array(50).fill().map((_,i)=>({r:0,g:255-i*5,b:i*5}))))
```

- Create an array with 50 (empty) elements:
  ```js
  new Array(50)
  ```
- Fill them (needed for `map` in the next step)
  ```js
  new Array(50).fill()
  ```
- For every element, set it to the color `{ r: 0, g: 255-i*5, b: i*5 }`,
  where `i` is the index of the current element (0 to 49).
  ```js
  new Array(50).fill().map((_,i)=>({r:0,g:255-i*5,b:i*5}))
  ```
- All this gets serialized to JSON and URI-encoded
  (needed to send it in the query string)
  ```js
  encodeURIComponent(JSON.stringify(...))
  ```
