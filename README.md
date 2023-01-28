![npm](https://img.shields.io/npm/v/@espruino-tools/uart)

# @espruino-tools/uart

UART is a package which enables easy communication between espruino low energy bluetooth devices (BLE) and web browsers that support webBluetooh. Providing methods for writing to devices, evaluating data on devices as well as connecting and disconnecting from devices.

## Features

- Connection (connect / disconnect)
- Writing to device
- Evaluating code on device
- resetting device
- logging device output

On top of these features this package features a well designed interface for device connection.

_This package was built for the usage of the `@espruino-tools/core` package, I would recommend investigating this package if you want a well designed platform for communicating with UART ready espruino devices as it fully incorporates this package whilst adding handy features._

## Installation

### CDN

We use unpkg to allow for CDN usage within the script tags it can be accessed like so within the body of the HTML file.

```html
<script src="https://unpkg.com/@espruino-tools/uart@latest/min/main.min.js"></script>
```

### NPM

run `npm i @espruino-tools/uart` in the root of your node project.

This can then be utlised by:

```javascript
import { uart } from "@espruino-tools/uart";

let UART = uart;

UART.write("LED1.digitalWrite(LED1, 1)");
```

_as mentioned above it is recommended to use the `core` package instead of the UART package as the implementation of this package is simplified without removing any functionality_
