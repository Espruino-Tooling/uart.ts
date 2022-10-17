import jss from "jss";
import preset from "jss-preset-default";

jss.setup(preset());

const styles = {
  menu: {
    color: "#b2b2b2b",
    background: "white",
    padding: "10px 16px 10px 16px",
    fontWeight: "medium",
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    border: "0.5px solid lightgray",
    "& .esp-tools-header-bar": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      "& *": {
        margin: 0,
      },

      "& div": {
        cursor: "pointer",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&:hover": {
          background: "rgba(0,0,0,0.05)",
        },
      },
    },
  },
  items: {
    color: "#000",
    background: "white",
    padding: "4px 8px 4px 8px",
    display: "grid",
    gridTemplateColumns: "fit-content(0)",
    gridTemplateRows: "fit-content(0)",
    borderBottomRightRadius: 7,
    borderBottomLeftRadius: 7,
    border: "0.5px solid lightgray",
    borderTop: 0,

    "& p": {
      content: "Select a connection method to pair your device",
      gridArea: "1 / 1 / 2 / 3",
      fontSize: 12,
      paddingLeft: 10,
      paddingTop: 5,
      margin: 0,
      color: "#7D7D7D",
    },
  },
  endpoints: {
    width: 100,
    height: 150,
    margin: "4px 0px 4px 0px",
    paddingLeft: 30,
    paddingRight: 30,
    borderRadius: 10,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    textAlign: "center",
    alignItems: "center",
    justifyContent: "center",
    "&:hover": {
      background: "rgba(0,0,0,0.05)",
    },
    "& .esp-tools-icons": {
      width: 48,
      height: 48,
    },
    "& .esp-tools-name": {
      fontSize: 14,
      fontWeight: 500,
      paddingTop: 8,
      paddingBottom: 4,
    },
    "& .esp-tools-description": {
      fontWeight: 300,
      fontSize: 12,
      color: "#666",
    },
  },
};

const { classes } = jss.createStyleSheet(styles).attach();

declare global {
  interface Window {
    MSStream: MSStreamType;
  }
}

interface Connection {
  isOpening: boolean;
  isOpen: boolean;
  received: string;
  txInProgress: boolean;
  cb?: Function | undefined;
  hadData?: boolean;
  close(callback?: Function): void;
  emit(evt: string, data?: string): void;
  write(data?: string, callback?: Function): void;
  on(name: string, action: Function): void;
}

interface UART {
  debug: number;
  flowControl: boolean;
  log: (level: number, s: string) => void;
  writeProgress: (charsSent?: any, charsTotal?: any) => void;
  connect: typeof connect;
  write: typeof write;
  eval: typeof evaluate;
  setTime: (cb: Function) => void;
  isConnected: () => boolean;
  getConnection: () => any;
  close: () => void;
  modal: (callback: Function) => void;
}

interface MSStreamType {
  type: string;
  msClose(): void;
  msDetachStream(): any;
}

declare const closeSerial: Function;

var isBusy: boolean;
// FIND OUT CORRECT TYPES FOR THIS
var queue: any[] = [];

// FIND OUT THE CORRECT TYPES FOR THIS
function ab2str(buf: any) {
  return String.fromCharCode.apply(null, new Uint8Array(buf) as any);
}
function str2ab(str: string) {
  var buf = new ArrayBuffer(str.length);
  var bufView = new Uint8Array(buf);
  for (var i = 0, strLen = str.length; i < strLen; i++)
    bufView[i] = str.charCodeAt(i);
  return buf;
}

function handleQueue() {
  if (!queue.length) return;
  var q = queue.shift();
  log(3, "Executing " + JSON.stringify(q) + " from queue");
  if (q.type == "eval") uart.eval(q.expr, q.cb);
  else if (q.type == "write") uart.write(q.data, q.callback, q.callbackNewline);
  else log(1, "Unknown queue item " + JSON.stringify(q));
}

function log(level: number, s: string) {
  if (uart.log) uart.log(level, s);
}

// FIND OUT CORRECT TYPES FOR THIS
var endpoints: any = [];

var WebBluetooth = {
  name: "Web Bluetooth",
  description: "Bluetooth LE devices",
  svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z" fill="#d2d2d2"/></svg>',
  isSupported: function () {
    if (
      navigator.platform.indexOf("Win") >= 0 &&
      (navigator.userAgent.indexOf("Chrome/54") >= 0 ||
        navigator.userAgent.indexOf("Chrome/55") >= 0 ||
        navigator.userAgent.indexOf("Chrome/56") >= 0)
    )
      return "Chrome <56 in Windows has navigator.bluetooth but it's not implemented properly";
    if (
      window &&
      window.location &&
      window.location.protocol == "http:" &&
      window.location.hostname != "localhost"
    )
      return "Serving off HTTP (not HTTPS) - Web Bluetooth not enabled";
    if (navigator.bluetooth) return true;
    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (iOS) {
      return "To use Web Bluetooth on iOS you'll need the WebBLE App.\nPlease go to https://itunes.apple.com/us/app/webble/id1193531073 to download it.";
    } else {
      return "This Web Browser doesn't support Web Bluetooth.\nPlease see https://www.espruino.com/Puck.js+Quick+Start";
    }
  },
  connect: function (connection: Connection, callback: Function) {
    var NORDIC_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
    var NORDIC_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
    var NORDIC_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
    var DEFAULT_CHUNKSIZE = 20;

    // FIND OUT CORRECT TYPES FOR THIS
    var btServer: any | undefined = undefined;
    var btService: any;
    var txCharacteristic: any;
    var rxCharacteristic: any;
    var txDataQueue: any[] = [];
    var flowControlXOFF: boolean = false;
    var chunkSize: number = DEFAULT_CHUNKSIZE;

    connection.close = function (callback: Function) {
      connection.isOpening = false;
      if (connection.isOpen) {
        connection.isOpen = false;
        connection.emit("close");
      } else {
        if (callback) callback(null);
      }
      if (btServer) {
        btServer.disconnect();
        btServer = undefined;
        txCharacteristic = undefined;
        rxCharacteristic = undefined;
      }
    };

    connection.write = function (data: string, callback?: Function) {
      if (data)
        txDataQueue.push({
          data: data,
          callback: callback,
          maxLength: data.length,
        });
      if (connection.isOpen && !connection.txInProgress) writeChunk();

      function writeChunk() {
        if (flowControlXOFF) {
          // flow control - try again later
          setTimeout(writeChunk, 50);
          return;
        }
        var chunk;
        if (!txDataQueue.length) {
          uart.writeProgress();
          return;
        }
        var txItem = txDataQueue[0];
        uart.writeProgress(
          txItem.maxLength - txItem.data.length,
          txItem.maxLength
        );
        if (txItem.data.length <= chunkSize) {
          chunk = txItem.data;
          txItem.data = undefined;
        } else {
          chunk = txItem.data.substr(0, chunkSize);
          txItem.data = txItem.data.substr(chunkSize);
        }
        connection.txInProgress = true;
        log(2, "Sending " + JSON.stringify(chunk));
        txCharacteristic
          .writeValue(str2ab(chunk))
          .then(function () {
            log(3, "Sent");
            if (!txItem.data) {
              txDataQueue.shift(); // remove this element
              if (txItem.callback) txItem.callback();
            }
            connection.txInProgress = false;
            writeChunk();
          })
          .catch(function (error: Error) {
            log(1, "SEND ERROR: " + error);
            txDataQueue = [];
            connection.close();
          });
      }
    };

    navigator.bluetooth
      .requestDevice({
        filters: [
          { namePrefix: "Puck.js" },
          { namePrefix: "Pixl.js" },
          { namePrefix: "MDBT42Q" },
          { namePrefix: "Bangle" },
          { namePrefix: "RuuviTag" },
          { namePrefix: "iTracker" },
          { namePrefix: "Thingy" },
          { namePrefix: "Espruino" },
          { services: [NORDIC_SERVICE] },
        ],
        optionalServices: [NORDIC_SERVICE],
      })
      .then(function (device) {
        log(1, "Device Name:       " + device.name);
        log(1, "Device ID:         " + device.id);
        // Was deprecated: Should use getPrimaryServices for this in future
        //log('BT>  Device UUIDs:      ' + device.uuids.join('\n' + ' '.repeat(21)));
        device.addEventListener("gattserverdisconnected", function () {
          log(1, "Disconnected (gattserverdisconnected)");
          connection.close();
        });
        return device.gatt!.connect();
      })
      .then(function (server) {
        log(1, "Connected");
        btServer = server;
        return server.getPrimaryService(NORDIC_SERVICE);
      })
      .then(function (service) {
        log(2, "Got service");
        btService = service;
        return btService.getCharacteristic(NORDIC_RX);
      })
      .then(function (characteristic) {
        rxCharacteristic = characteristic;
        log(2, "RX characteristic:" + JSON.stringify(rxCharacteristic));
        rxCharacteristic.addEventListener(
          "characteristicvaluechanged",
          function (event: any) {
            var dataview = event.target.value;
            if (dataview.byteLength > chunkSize) {
              log(
                2,
                "Received packet of length " +
                  dataview.byteLength +
                  ", increasing chunk size"
              );
              chunkSize = dataview.byteLength;
            }
            if (uart.flowControl) {
              for (var i = 0; i < dataview.byteLength; i++) {
                var ch = dataview.getUint8(i);
                if (ch == 17) {
                  // XON
                  log(2, "XON received => resume upload");
                  flowControlXOFF = false;
                }
                if (ch == 19) {
                  // XOFF
                  log(2, "XOFF received => pause upload");
                  flowControlXOFF = true;
                }
              }
            }
            var str = ab2str(dataview.buffer);
            log(3, "Received " + JSON.stringify(str));
            connection.emit("data", str);
          }
        );
        return rxCharacteristic.startNotifications();
      })
      .then(function () {
        return btService.getCharacteristic(NORDIC_TX);
      })
      .then(function (characteristic) {
        txCharacteristic = characteristic;
        log(2, "TX characteristic:" + JSON.stringify(txCharacteristic));
      })
      .then(function () {
        connection.txInProgress = false;
        connection.isOpen = true;
        connection.isOpening = false;
        isBusy = false;
        queue = [];
        callback(connection);
        connection.emit("open");
        // if we had any writes queued, do them now
        if (typeof connection.write !== undefined) {
          connection.write();
        } else {
          connection.close();
        }
      })
      .catch(function (error) {
        log(1, "ERROR: " + error);
        connection.close();
      });
    return connection;
  },
};
var WebSerial = {
  name: "Web Serial",
  description: "USB connected devices",
  svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M15 7v4h1v2h-3V5h2l-3-4-3 4h2v8H8v-2.07c.7-.37 1.2-1.08 1.2-1.93 0-1.21-.99-2.2-2.2-2.2-1.21 0-2.2.99-2.2 2.2 0 .85.5 1.56 1.2 1.93V13c0 1.11.89 2 2 2h3v3.05c-.71.37-1.2 1.1-1.2 1.95 0 1.22.99 2.2 2.2 2.2 1.21 0 2.2-.98 2.2-2.2 0-.85-.49-1.58-1.2-1.95V15h3c1.11 0 2-.89 2-2v-2h1V7h-4z" fill="#d2d2d2"/></svg>',
  isSupported: function () {
    if (!navigator.serial)
      return "No navigator.serial - Web Serial not enabled";
    if (
      window &&
      window.location &&
      window.location.protocol == "http:" &&
      window.location.hostname != "localhost"
    )
      return "Serving off HTTP (not HTTPS) - Web Serial not enabled";
    return true;
  },
  connect: function (connection: Connection, callback: Function) {
    var serialPort: SerialPort | undefined;
    function disconnected() {
      connection.isOpening = false;
      if (connection.isOpen) {
        log(1, "Disconnected");
        connection.isOpen = false;
        connection.emit("close");
      }
    }
    // TODO: Pass USB vendor and product ID filter when supported by Chrome.
    navigator.serial
      .requestPort()
      .then(function (port) {
        log(1, "Connecting to serial port");
        serialPort = port;
        return port.open({ baudRate: 115200 });
      })
      .then(function () {
        function readLoop() {
          var reader = (serialPort as SerialPort).readable.getReader();
          // FIND OUT CORRECT TYPES FOR THIS
          reader.read().then(function ({ value, done }: any) {
            reader.releaseLock();
            if (value) {
              var str = ab2str(value.buffer);
              log(3, "Received " + JSON.stringify(str));
              connection.emit("data", str);
            }
            if (done) {
              disconnected();
            } else {
              readLoop();
            }
          });
        }
        readLoop();
        log(1, "Serial connected. Receiving data...");
        connection.txInProgress = false;
        connection.isOpen = true;
        connection.isOpening = false;
        callback(connection);
      })
      .catch(function (error) {
        log(0, "ERROR: " + error);
        disconnected();
      });
    connection.close = function (callback: Function) {
      if (serialPort) {
        serialPort.close();
        serialPort = undefined;
      }
      disconnected();
    };
    connection.write = function (data: string, callback?: Function) {
      var writer = (serialPort as SerialPort).writable.getWriter();
      // TODO: progress?
      writer
        .write(str2ab(data))
        .then(function () {
          callback?.();
        })
        .catch(function (error: Error) {
          log(0, "SEND ERROR: " + error);
          closeSerial();
        });
      writer.releaseLock();
    };

    return connection;
  },
};
// ======================================================================
endpoints.push(WebBluetooth);
endpoints.push(WebSerial);
// ======================================================================
var connection: Connection | undefined;
function connect(callback: Function) {
  var connection = {
    on: function (evt: string, cb: Function) {
      (this as any)["on" + evt] = cb;
    },
    emit: function (evt: string, data?: string) {
      if ((this as any)["on" + evt]) (this as any)["on" + evt](data);
    },
    isOpen: false,
    isOpening: true,
    txInProgress: false,
  } as any;

  connection!.on("close", function (d: string) {
    connection = undefined;
  });

  // modal
  var e = document.createElement("div");
  e.setAttribute(
    "style",
    "position:absolute;top:0px;left:0px;right:0px;bottom:0px;opacity:0.5;z-index:100;background:black;"
  );
  // menu
  var menu = document.createElement("div");
  menu.setAttribute(
    "style",
    "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-family: Sans-Serif;z-index:101;"
  );

  var menutitle = document.createElement("div");
  menutitle.classList.add(classes.menu);

  var menuContent = document.createElement("div");
  menuContent.classList.add("esp-tools-header-bar");

  let menuTitle = document.createElement("p");
  menuTitle.innerText = "Connect";

  menuContent.appendChild(menuTitle);

  let menuClose = document.createElement("div");
  menuClose.innerHTML =
    '<svg id="esp-tools-close-modal" stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" stroke-width="2" d="M7,7 L17,17 M7,17 L17,7"></path></svg>';

  menuContent.appendChild(menuClose);

  menutitle.appendChild(menuContent);

  menu.appendChild(menutitle);
  var items = document.createElement("div");
  items.classList.add(classes.items);
  let p = document.createElement("p");
  p.innerText = "Select a connection method to pair your device";
  items.appendChild(p);
  menu.appendChild(items);
  // FIND OUT CORRECT TYPES FOR THIS

  endpoints.forEach(function (endpoint: any) {
    var supported = endpoint.isSupported();
    if (supported !== true)
      log(0, endpoint.name + " not supported, " + supported);
    var ep = document.createElement("div");
    ep.classList.add(classes.endpoints);
    ep.innerHTML =
      '<div class="esp-tools-icons">' +
      endpoint.svg +
      "</div>" +
      '<div class="esp-tools-name">' +
      endpoint.name +
      "</div>" +
      '<div class="esp-tools-description">' +
      endpoint.description +
      "</div>";
    ep.onclick = function (evt) {
      connection = endpoint.connect(connection, callback);
      evt.preventDefault();
      document.body.removeChild(menu);
      document.body.removeChild(e);
    };
    items.appendChild(ep);
  });

  menuClose.onclick = function () {
    document.body.removeChild(menu);
    document.body.removeChild(e);
    connection.isOpening = false;
    if (connection.isOpen) {
      connection.isOpen = false;
      connection.emit("close");
    } else {
      if (callback) callback(null);
    }
  };

  document.body.appendChild(e);
  document.body.appendChild(menu);
  return connection;
}
function checkIfSupported() {
  var anySupported = false;
  // FIND OUT CORRECT TYPES FOR THIS
  endpoints.forEach(function (endpoint: any) {
    var supported = endpoint.isSupported();
    if (supported === true) anySupported = true;
    else log(0, endpoint.name + " not supported, " + supported);
  });
  return anySupported;
}
// ======================================================================
/* convenience function... Write data, call the callback with data:
     callbackNewline = false => if no new data received for ~0.2 sec
     callbackNewline = true => after a newline */
function write(data: string, callback?: Function, callbackNewline?: boolean) {
  if (!checkIfSupported()) return;
  if (isBusy) {
    log(3, "Busy - adding write to queue");
    queue.push({
      type: "write",
      data: data,
      callback: callback,
      callbackNewline: callbackNewline,
    });
    return;
  }

  // FIND OUT CORRECT TYPES FOR THIS
  var cbTimeout: any;
  function onWritten() {
    if (callbackNewline) {
      connection!.cb = function () {
        var newLineIdx = connection!.received.indexOf("\n");
        if (newLineIdx >= 0) {
          var l = connection!.received.substr(0, newLineIdx);
          connection!.received = connection!.received.substr(newLineIdx + 1);
          connection!.cb = undefined;
          if (cbTimeout) clearTimeout(cbTimeout);
          cbTimeout = undefined;
          if (callback) callback(l);
          isBusy = false;
          handleQueue();
        }
      };
    }
    // wait for any received data if we have a callback...
    var maxTime = 300; // 30 sec - Max time we wait in total, even if getting data
    var dataWaitTime = callbackNewline
      ? 100 /*10 sec  if waiting for newline*/
      : 3; /*300ms*/
    var maxDataTime = dataWaitTime; // max time we wait after having received data
    cbTimeout = setTimeout(function timeout() {
      cbTimeout = undefined;
      if (maxTime) maxTime--;
      if (maxDataTime) maxDataTime--;
      if (connection!.hadData) maxDataTime = dataWaitTime;
      if (maxDataTime && maxTime) {
        cbTimeout = setTimeout(timeout, 100);
      } else {
        connection!.cb = undefined;
        if (callbackNewline) log(2, "write waiting for newline timed out");
        if (callback) callback(connection!.received);
        isBusy = false;
        handleQueue();
        connection!.received = "";
      }
      connection!.hadData = false;
    }, 100);
  }

  if (connection && (connection.isOpen || connection.isOpening)) {
    if (!connection.txInProgress) connection.received = "";
    isBusy = true;
    if (typeof connection.write !== undefined) {
      return connection.write(data, onWritten);
    } else {
      return connection.close();
    }
  }

  // FIND OUT CORRECT TYPES FOR THIS
  (connection as any) = connect(function (uart: UART) {
    if (!uart) {
      connection = undefined;
      if (callback) callback(null);
      return;
    }
    connection!.received = "";
    connection!.on("data", function (d: string) {
      connection!.received += d;
      connection!.hadData = true;
      if (connection!.cb) connection!.cb(d);
    });
    connection!.on("close", function (d: string) {
      connection = undefined;
    });
    isBusy = true;
    connection!.write(data, onWritten);
  });
}

function evaluate(expr: string, cb: Function) {
  if (!checkIfSupported()) return;
  if (isBusy) {
    log(3, "Busy - adding eval to queue");
    queue.push({ type: "eval", expr: expr, cb: cb });
    return;
  }
  write(
    "\x10eval(process.env.CONSOLE).println(JSON.stringify(" + expr + "))\n",
    function (d: string) {
      try {
        var json = JSON.parse(d.trim());
        cb(json);
      } catch (e: any) {
        log(
          1,
          "Unable to decode " + JSON.stringify(d) + ", got " + e.toString()
        );
        cb(
          null,
          "Unable to decode " + JSON.stringify(d) + ", got " + e.toString()
        );
      }
    },
    true /*callbackNewline*/
  );
}

// ----------------------------------------------------------

var uart: UART = {
  /// Are we writing debug information? 0 is no, 1 is some, 2 is more, 3 is all.
  debug: 1,
  /// Should we use flow control? Default is true
  flowControl: true,
  /// Used internally to write log information - you can replace this with your own function
  log: function (level: number, s: string) {
    if (level <= this.debug) console.log("<UART> " + s);
  },
  /// Called with the current send progress or undefined when done - you can replace this with your own function
  // FIND OUT CORRECT TYPES FOR THIS
  writeProgress: function (charsSent?: number, charsTotal?: number) {
    // console.log(charsSent + "/" + charsTotal);
  },
  /** Connect to a new device - this creates a separate
   connection to the one `write` and `eval` use. */
  connect: connect,
  /// Write to a device and call back when the data is written.  Creates a connection if it doesn't exist
  write: write,
  /// Evaluate an expression and call cb with the result. Creates a connection if it doesn't exist
  eval: evaluate,
  /// Write the current time to the device
  setTime: function (cb: Function) {
    var d = new Date();
    var cmd = "setTime(" + d.getTime() / 1000 + ");";
    // in 1v93 we have timezones too
    cmd +=
      "if (E.setTimeZone) E.setTimeZone(" +
      d.getTimezoneOffset() / -60 +
      ");\n";
    write(cmd, cb);
  },
  /// Did `write` and `eval` manage to create a connection?
  isConnected: function () {
    return connection !== undefined;
  },
  /// get the connection used by `write` and `eval`
  getConnection: function () {
    return connection;
  },
  /// Close the connection used by `write` and `eval`
  close: function () {
    if (connection) connection.close();
  },
  /** Utility function to fade out everything on the webpage and display
  a window saying 'Click to continue'. When clicked it'll disappear and
  'callback' will be called. This is useful because you can't initialise
  Web Bluetooth unless you're doing so in response to a user input.*/
  modal: function (callback: Function) {
    var e = document.createElement("div");
    e.setAttribute(
      "style",
      "position:absolute;top:0px;left:0px;right:0px;bottom:0px;opacity:0.5;z-index:100;background:black;"
    );
    e.innerHTML =
      '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-family: Sans-Serif;font-size:400%;color:white;">Click to Continue...</div>';
    e.onclick = function (evt) {
      callback();
      evt.preventDefault();
      document.body.removeChild(e);
    };
    document.body.appendChild(e);
  },
};

export { uart };
