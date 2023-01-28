import { Connection, Endpoint, Queue, UART } from "./types/uartTypes";
import { ab2str, str2ab } from "./helpers/stringArrayBuffer";
import { classes } from "./styles/modal";
import { isIOS } from "./helpers/isIOS";

interface UARTOptions {
  dataWaitTime: number;
}

class UARTClass implements UART {
  DATA_WAIT_TIME?: number;

  constructor(options?: UARTOptions) {
    this.DATA_WAIT_TIME = options?.dataWaitTime;
  }

  #debug: number = 3;
  isBusy: boolean = false;
  #flowControl: boolean = true;
  #queue: Queue[] = [];
  #sentChunks: any[] = [];
  #connection: Connection | any;
  #endpoints: Endpoint[] = [
    {
      name: "Web Bluetooth",
      description: "Bluetooth LE devices",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z" fill="#d2d2d2"/></svg>',
      isSupported: () => {
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
        var iOS = isIOS();
        if (iOS) {
          return "To use Web Bluetooth on iOS you'll need the WebBLE App.\nPlease go to https://itunes.apple.com/us/app/webble/id1193531073 to download it.";
        } else {
          return "This Web Browser doesn't support Web Bluetooth.\nPlease see https://www.espruino.com/Puck.js+Quick+Start";
        }
      },
      connect: (connection: Connection, callback: Function) => {
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

        connection.close = (callback: Function) => {
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

        connection.write = (data: string, callback?: Function) => {
          if (data)
            txDataQueue.push({
              data: data,
              callback: callback,
              maxLength: data.length,
            });

          const writeChunk = () => {
            if (flowControlXOFF) {
              // flow control - try again later
              setTimeout(writeChunk, 50);
              return;
            }
            var chunk;
            if (!txDataQueue.length) {
              return;
            }
            var txItem = txDataQueue[0];
            if (txItem.data.length <= chunkSize) {
              chunk = txItem.data;
              txItem.data = undefined;
            } else {
              chunk = txItem.data.substr(0, chunkSize);
              txItem.data = txItem.data.substr(chunkSize);
            }
            connection.txInProgress = true;
            this.#log(2, "Sending " + JSON.stringify(chunk));
            this.#sentChunks.push(JSON.stringify(chunk));
            txCharacteristic
              .writeValue(str2ab(chunk))
              .then(() => {
                this.#log(3, "Sent");
                if (!txItem.data) {
                  txDataQueue.shift(); // remove this element
                  if (txItem.callback) txItem.callback();
                }
                connection.txInProgress = false;
                writeChunk();
              })
              .catch((error: Error) => {
                this.#log(1, "SEND ERROR: " + error);
                txDataQueue = [];
                connection.close();
              });
          };

          if (connection.isOpen && !connection.txInProgress) writeChunk();
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
          .then((device) => {
            this.#log(1, "Device Name:       " + device.name);
            this.#log(1, "Device ID:         " + device.id);
            // Was deprecated: Should use getPrimaryServices for this in future
            //log('BT>  Device UUIDs:      ' + device.uuids.join('\n' + ' '.repeat(21)));
            device.addEventListener("gattserverdisconnected", () => {
              this.#log(1, "Disconnected (gattserverdisconnected)");
              connection.close();
            });
            return device.gatt!.connect();
          })
          .then((server) => {
            this.#log(1, "Connected");
            btServer = server;
            return server.getPrimaryService(NORDIC_SERVICE);
          })
          .then((service) => {
            this.#log(2, "Got service");
            btService = service;
            return btService.getCharacteristic(NORDIC_RX);
          })
          .then((characteristic) => {
            rxCharacteristic = characteristic;
            this.#log(
              2,
              "RX characteristic:" + JSON.stringify(rxCharacteristic)
            );
            rxCharacteristic.addEventListener(
              "characteristicvaluechanged",
              (event: any) => {
                var dataview = event.target.value;
                if (dataview.byteLength > chunkSize) {
                  this.#log(
                    2,
                    "Received packet of length " +
                      dataview.byteLength +
                      ", increasing chunk size"
                  );
                  chunkSize = dataview.byteLength;
                }
                if (this.#flowControl) {
                  for (var i = 0; i < dataview.byteLength; i++) {
                    var ch = dataview.getUint8(i);
                    if (ch == 17) {
                      // XON
                      this.#log(2, "XON received => resume upload");
                      flowControlXOFF = false;
                    }
                    if (ch == 19) {
                      // XOFF
                      this.#log(2, "XOFF received => pause upload");
                      flowControlXOFF = true;
                    }
                  }
                }
                var str = ab2str(dataview.buffer);
                this.#log(3, "Received " + JSON.stringify(str));
                connection.emit("data", str);
              }
            );
            return rxCharacteristic.startNotifications();
          })
          .then(function () {
            return btService.getCharacteristic(NORDIC_TX);
          })
          .then((characteristic) => {
            txCharacteristic = characteristic;
            this.#log(
              2,
              "TX characteristic:" + JSON.stringify(txCharacteristic)
            );
          })
          .then(() => {
            connection.txInProgress = false;
            connection.isOpen = true;
            connection.isOpening = false;
            this.isBusy = false;
            this.#queue = [];
            callback(connection);
            connection.emit("open");
            // if we had any writes queued, do them now
            connection.write();
          })
          .catch((error) => {
            this.#log(1, "ERROR: " + error);
            connection.close();
          });
        return connection;
      },
    },
    {
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
      connect: (connection: Connection, callback: Function) => {
        var serialPort: SerialPort | undefined;
        const disconnected = () => {
          connection.isOpening = false;
          if (connection.isOpen) {
            this.#log(1, "Disconnected");
            connection.isOpen = false;
            connection.emit("close");
          }
        };
        // TODO: Pass USB vendor and product ID filter when supported by Chrome.
        navigator.serial
          .requestPort()
          .then((port) => {
            this.#log(1, "Connecting to serial port");
            serialPort = port;
            return port.open({ baudRate: 115200 });
          })
          .then(() => {
            const readLoop = () => {
              var reader = (serialPort as SerialPort).readable.getReader();
              // FIND OUT CORRECT TYPES FOR THIS
              reader.read().then(({ value, done }: any) => {
                reader.releaseLock();
                if (value) {
                  var str = ab2str(value.buffer);
                  this.#log(3, "Received " + JSON.stringify(str));
                  connection.emit("data", str);
                }
                if (done) {
                  disconnected();
                } else {
                  readLoop();
                }
              });
            };
            readLoop();
            this.#log(1, "Serial connected. Receiving data...");
            connection.txInProgress = false;
            connection.isOpen = true;
            connection.isOpening = false;
            callback(connection);
          })
          .catch((error) => {
            this.#log(0, "ERROR: " + error);
            disconnected();
          });
        connection.close = function (callback: Function) {
          if (serialPort) {
            serialPort.close();
            serialPort = undefined;
          }
          disconnected();
        };
        connection.write = (data: string, callback?: Function) => {
          var writer = (serialPort as SerialPort).writable.getWriter();
          // TODO: progress?
          writer
            .write(str2ab(data))
            .then(() => {
              callback?.(data);
            })
            .catch((error: Error) => {
              this.#log(0, "SEND ERROR: " + error);
            });
          writer.releaseLock();
        };

        return connection;
      },
    },
  ];
  connect(callback: Function) {
    this.#connection = {
      on: function (evt: string, cb: Function) {
        (this as any)["on" + evt] = cb;
      },
      emit: function (evt: string, data?: string) {
        if ((this as any)["on" + evt]) (this as any)["on" + evt](data);
      },
      isOpen: false,
      isOpening: true,
      txInProgress: false,
    };

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

    this.#endpoints.forEach((endpoint: any) => {
      var supported = endpoint.isSupported();
      if (supported !== true)
        this.#log(0, endpoint.name + " not supported, " + supported);
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
      ep.onclick = (evt) => {
        this.#connection = endpoint.connect(this.#connection, callback);
        evt.preventDefault();
        document.body.removeChild(menu);
        document.body.removeChild(e);
      };
      items.appendChild(ep);
    });

    menuClose.onclick = () => {
      document.body.removeChild(menu);
      document.body.removeChild(e);
      this.#connection!.isOpening = false;
      if (this.#connection!.isOpen) {
        this.#connection!.isOpen = false;
      } else {
        if (callback) callback(null);
      }
    };

    document.body.appendChild(e);
    document.body.appendChild(menu);
    return this.#connection;
  }
  getWrittenData(): Promise<string> {
    let str_chunks: string = this.#sentChunks.join("");
    return new Promise<string>((resolve) => resolve(str_chunks));
  }
  write(data: string, callback?: Function, callbackNewline?: boolean) {
    if (!this.#checkIfSupported()) return;
    if (this.isBusy) {
      this.#log(3, "Busy - adding write to queue");
      this.#queue.push({
        type: "write",
        data: data,
        callback: callback,
        callbackNewline: callbackNewline,
      });
      return;
    }
    var cbTimeout: any;
    const onWritten = () => {
      if (callbackNewline) {
        this.#connection!.cb = () => {
          var newLineIdx = this.#connection!.received.indexOf("\n");
          if (newLineIdx >= 0) {
            var l = this.#connection!.received.substr(0, newLineIdx);
            this.#connection!.received = this.#connection!.received.substr(
              newLineIdx + 1
            );
            this.#connection!.cb = undefined;
            if (cbTimeout) clearTimeout(cbTimeout);
            cbTimeout = undefined;
            if (callback) callback(l);
            this.isBusy = false;
            this.#handleQueue();
          }
        };
      }
      // wait for any received data if we have a callback...
      var maxTime = 300; // 30 sec - Max time we wait in total, even if getting data
      var dataWaitTime = callbackNewline
        ? 100 /*10 sec  if waiting for newline*/
        : 0; /*300ms*/
      var maxDataTime = dataWaitTime; // max time we wait after having received data

      const timeout = () => {
        cbTimeout = undefined;
        if (maxTime) maxTime--;
        if (maxDataTime) maxDataTime--;
        if (this.#connection!.hadData) maxDataTime = dataWaitTime;
        if (maxDataTime && maxTime) {
          cbTimeout = setTimeout(timeout, 100);
        } else {
          this.#connection!.cb = undefined;
          if (callbackNewline)
            this.#log(2, "write waiting for newline timed out");
          if (callback) callback(this.#connection!.received);
          this.isBusy = false;
          this.#handleQueue();
          this.#connection!.received = "";
        }
        this.#connection!.hadData = false;
      };
      cbTimeout = setTimeout(timeout, 100);
    };

    if (
      this.#connection &&
      (this.#connection.isOpen || this.#connection.isOpening)
    ) {
      if (!this.#connection.txInProgress) this.#connection.received = "";
      this.isBusy = true;
      return this.#connection.write(data, onWritten);
    }

    this.#connection = this.connect((uart: UART) => {
      if (!uart) {
        this.#connection = undefined;
        if (callback) callback(null);
        return;
      }
      this.#connection!.received = "";
      this.#connection!.on("data", (d: string) => {
        this.#connection!.received += d;
        this.#connection!.hadData = true;
        if (this.#connection!.cb) this.#connection!.cb(d);
      });
      this.#connection!.on("close", (d: string) => {
        this.#connection = undefined;
      });
      this.isBusy = true;
      this.#connection!.write(data, onWritten);
    });
  }
  eval(expr: string, cb: Function) {
    if (!this.#checkIfSupported()) return false;
    if (this.isBusy) {
      this.#log(3, "Busy - adding eval to queue");
      this.#queue.push({ type: "eval", expr: expr, cb: cb });
      return false;
    }
    this.write(
      "\x10eval(process.env.CONSOLE).println(JSON.stringify(" + expr + "))\n",
      (d: string) => {
        try {
          var json = JSON.parse(d.trim());
          cb(json, "success");
        } catch (e: any) {
          this.#log(
            1,
            "Unable to decode " + JSON.stringify(d) + ", got " + e.toString()
          );
          cb(null, "failed");
        }
      },
      true /*callbackNewline*/
    );
    return true;
  }
  setTime(cb: Function): any {
    let d = new Date();
    let cmd = "setTime(" + d.getTime() / 1000 + ");";
    cmd +=
      "if (E.setTimeZone) E.setTimeZone(" +
      d.getTimezoneOffset() / -60 +
      ");\n";
    this.write(cmd, cb);
  }
  isConnected() {
    return this.#connection !== undefined;
  }
  getConnection() {
    return this.#connection;
  }
  close() {
    if (this.#connection) this.#connection.close();
  }
  #handleQueue() {
    if (!this.#queue.length) return;
    var q = this.#queue.shift();
    this.#log(3, "Executing " + JSON.stringify(q) + " from queue");
    if (q!.type == "eval") this.eval(q!.expr!, q!.cb!);
    else if (q!.type == "write")
      this.write(q!.data!, q!.callback, q!.callbackNewline);
    else this.#log(1, "Unknown queue item " + JSON.stringify(q));
  }
  #log(level: number, s: string) {
    level <= this.#debug && console.log("<UART> " + s);
  }
  #checkIfSupported(): boolean {
    var anySupported = false;
    this.#endpoints.forEach((endpoint: any) => {
      var supported = endpoint.isSupported();
      if (supported === true) anySupported = true;
      else this.#log(0, endpoint.name + " not supported, " + supported);
    });
    return anySupported;
  }
}

let uart = new UARTClass();

export { uart };
