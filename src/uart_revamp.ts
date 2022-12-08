import { ab2str, str2ab } from "./helpers/stringArrayBuffer";
import jss from "jss";
import preset from "jss-preset-default";
import { Connection, UART } from "./types/uartTypes";

jss.setup(preset());

export class Uart {
  private styles = {
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

  private classList = jss.createStyleSheet(this.styles).attach();

  flowControl: boolean = true;
  debug: number = 1;
  isBusy: boolean | undefined = undefined;
  queue: any[] = [];
  endpoints: any[] = [
    {
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
        var iOS =
          /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
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

        connection.write = (data: string, callback?: Function) => {
          const writeChunk = () => {
            if (flowControlXOFF) {
              // flow control - try again later
              setTimeout(writeChunk, 50);
              return;
            }
            var chunk;
            var txItem = txDataQueue[0];

            if (txItem.data.length <= chunkSize) {
              chunk = txItem.data;
              txItem.data = undefined;
            } else {
              chunk = txItem.data.substr(0, chunkSize);
              txItem.data = txItem.data.substr(chunkSize);
            }
            connection.txInProgress = true;
            console.log("<UART>", "Sending " + JSON.stringify(chunk));
            txCharacteristic
              .writeValue(str2ab(chunk))
              .then(() => {
                console.log("<UART>", "Sent");
                if (!txItem.data) {
                  txDataQueue.shift(); // remove this element
                  if (txItem.callback) txItem.callback();
                }
                connection.txInProgress = false;
                writeChunk();
              })
              .catch((error: Error) => {
                console.log("<UART>", "SEND ERROR: " + error);
                txDataQueue = [];
                connection.close();
              });
          };
          if (data)
            txDataQueue.push({
              data: data,
              callback: callback,
              maxLength: data.length,
            });
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
            console.log("<UART>", "Device Name:       " + device.name);
            console.log("<UART>", "Device ID:         " + device.id);
            // Was deprecated: Should use getPrimaryServices for this in future
            //log('BT>  Device UUIDs:      ' + device.uuids.join('\n' + ' '.repeat(21)));
            device.addEventListener("gattserverdisconnected", () => {
              console.log("<UART>", "Disconnected (gattserverdisconnected)");
              connection.close();
            });
            return device.gatt!.connect();
          })
          .then((server) => {
            console.log("<UART>", "Connected");
            btServer = server;
            return server.getPrimaryService(NORDIC_SERVICE);
          })
          .then((service) => {
            console.log("<UART>", "Got service");
            btService = service;
            return btService.getCharacteristic(NORDIC_RX);
          })
          .then((characteristic) => {
            rxCharacteristic = characteristic;
            console.log(
              "<UART>",
              "RX characteristic:" + JSON.stringify(rxCharacteristic)
            );
            rxCharacteristic.addEventListener(
              "characteristicvaluechanged",
              (event: any) => {
                var dataview = event.target.value;
                if (dataview.byteLength > chunkSize) {
                  console.log(
                    "<UART>",
                    "Received packet of length " +
                      dataview.byteLength +
                      ", increasing chunk size"
                  );
                  chunkSize = dataview.byteLength;
                }
                if (this.flowControl) {
                  for (var i = 0; i < dataview.byteLength; i++) {
                    var ch = dataview.getUint8(i);
                    if (ch == 17) {
                      // XON
                      console.log("<UART>", "XON received => resume upload");
                      flowControlXOFF = false;
                    }
                    if (ch == 19) {
                      // XOFF
                      console.log("<UART>", "XOFF received => pause upload");
                      flowControlXOFF = true;
                    }
                  }
                }
                var str = ab2str(dataview.buffer);
                console.log("<UART>", "Received " + JSON.stringify(str));
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
            console.log(
              "<UART>",
              "TX characteristic:" + JSON.stringify(txCharacteristic)
            );
          })
          .then(() => {
            connection.txInProgress = false;
            connection.isOpen = true;
            connection.isOpening = false;
            this.isBusy = false;
            this.queue = [];
            callback(connection);
            connection.emit("open");
            // if we had any writes queued, do them now
            connection.write();
          })
          .catch((error) => {
            console.log("<UART>", "ERROR: " + error);
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
      connect: function (connection: Connection, callback: Function) {
        var serialPort: SerialPort | undefined;
        const disconnected = () => {
          connection.isOpening = false;
          if (connection.isOpen) {
            console.log("<UART>", "Disconnected");
            connection.isOpen = false;
            connection.emit("close");
          }
        };
        // TODO: Pass USB vendor and product ID filter when supported by Chrome.
        navigator.serial
          .requestPort()
          .then((port) => {
            console.log("<UART>", "Connecting to serial port");
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
                  console.log("<UART>", "Received " + JSON.stringify(str));
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
            console.log("<UART>", "Serial connected. Receiving data...");
            connection.txInProgress = false;
            connection.isOpen = true;
            connection.isOpening = false;
            callback(connection);
          })
          .catch((error) => {
            console.log("<UART>", "ERROR: " + error);
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
              callback?.();
            })
            .catch((error: Error) => {
              console.log("<UART>", "SEND ERROR: " + error);
              this.closeSerial();
            });
          writer.releaseLock();
        };

        return connection;
      },
    },
  ];
  connection: Connection | undefined;

  connect = (callback: Function) => {
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
    };

    this.connection!.hadData = false;
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
    menutitle.classList.add(this.classList.classes.menu);

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
    items.classList.add(this.classList.classes.items);
    let p = document.createElement("p");
    p.innerText = "Select a connection method to pair your device";
    items.appendChild(p);
    menu.appendChild(items);
    // FIND OUT CORRECT TYPES FOR THIS

    this.endpoints.forEach((endpoint: any) => {
      var supported = endpoint.isSupported();
      if (supported !== true)
        console.log("<UART>", endpoint.name + " not supported, " + supported);
      var ep = document.createElement("div");
      ep.classList.add(this.classList.classes.endpoints);
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
      } else {
        if (callback) callback(null);
      }
    };

    document.body.appendChild(e);
    document.body.appendChild(menu);
    return connection;
  };

  log(level: number, s: string) {
    if (level <= this.debug) console.log("<UART> " + s);
  }

  checkIfSupported() {
    var anySupported = false;
    // FIND OUT CORRECT TYPES FOR THIS
    this.endpoints.forEach((endpoint: any) => {
      var supported = endpoint.isSupported();
      if (supported === true) anySupported = true;
      else
        console.log("<UART>", endpoint.name + " not supported, " + supported);
    });
    return anySupported;
  }

  eval(expr: any, cb: Function) {
    if (!this.checkIfSupported()) return false;
    if (this.isBusy) {
      console.log("<UART>", "Busy - adding eval to queue");
      this.queue.push({ type: "eval", expr: expr, cb: cb });
      return false;
    }
    this.write(
      "\x10eval(process.env.CONSOLE).println(JSON.stringify(" + expr + "))\n",
      (d: string) => {
        try {
          var json = JSON.parse(d.trim());
          cb(json, "success");
        } catch (e: any) {
          console.log(
            "<UART>",
            "Unable to decode " + JSON.stringify(d) + ", got " + e.toString()
          );
          cb(null, "failed");
        }
      },
      true /*callbackNewline*/
    );
    return true;
  }
  write(data: any, callback?: Function, callbackNewline?: boolean) {
    if (!this.checkIfSupported()) return;
    if (this.isBusy) {
      console.log("<UART>", "Busy - adding write to queue");
      this.queue.push({
        type: "write",
        data: data,
        callback: callback,
        callbackNewline: callbackNewline,
      });
      return;
    }

    // FIND OUT CORRECT TYPES FOR THIS
    var cbTimeout: any;
    const onWritten = () => {
      if (callbackNewline) {
        this.connection!.cb = () => {
          var newLineIdx = this.connection!.received.indexOf("\n");
          if (newLineIdx >= 0) {
            var l = this.connection!.received.substr(0, newLineIdx);
            this.connection!.received = this.connection!.received.substr(
              newLineIdx + 1
            );
            this.connection!.cb = undefined;
            if (cbTimeout) clearTimeout(cbTimeout);
            cbTimeout = undefined;
            if (callback) callback(l);
            this.isBusy = false;
            this.handleQueue();
          }
        };
      }
      // wait for any received data if we have a callback...
      var maxTime = 300; // 30 sec - Max time we wait in total, even if getting data
      var dataWaitTime = callbackNewline
        ? 100 /*10 sec  if waiting for newline*/
        : 3; /*300ms*/
      var maxDataTime = dataWaitTime; // max time we wait after having received data
      const timeout = () => {
        cbTimeout = undefined;
        if (maxTime) maxTime--;
        if (maxDataTime) maxDataTime--;
        if (this.connection!.hadData) maxDataTime = dataWaitTime;
        if (maxDataTime && maxTime) {
          cbTimeout = setTimeout(timeout, 100);
        } else {
          this.connection!.cb = undefined;
          if (callbackNewline)
            console.log("<UART>", "write waiting for newline timed out");
          if (callback) callback(this.connection!.received);
          this.isBusy = false;
          this.handleQueue();
          this.connection!.received = "";
        }
        this.connection!.hadData = false;
      };
      cbTimeout = setTimeout(timeout, 100);
    };

    if (
      this.connection &&
      (this.connection.isOpen || this.connection.isOpening)
    ) {
      if (!this.connection.txInProgress) this.connection.received = "";
      this.isBusy = true;
      return this.connection.write(data, onWritten);
    }

    // FIND OUT CORRECT TYPES FOR THIS
    (this.connection as any) = this.connect((uart: UART) => {
      if (!uart) {
        this.connection = undefined;
        if (callback) callback(null);
        return;
      }
      this.connection!.received = "";
      this.connection!.on("data", (d: string) => {
        this.connection!.received += d;
        this.connection!.hadData = true;
        if (this.connection!.cb) this.connection!.cb(d);
      });
      this.connection!.on("close", (d: string) => {
        this.connection = undefined;
      });
      this.isBusy = true;
      this.connection!.write(data, onWritten);
    });
  }

  modal(callback: Function): void {
    let e = document.createElement("div");
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
  }

  private handleQueue() {
    if (!this.queue.length) return;
    var q = this.queue.shift();
    console.log("<UART>", "Executing " + JSON.stringify(q) + " from queue");
    if (q.type == "eval") this.eval(q.expr, q.cb);
    else if (q.type == "write")
      this.write(q.data, q.callback, q.callbackNewline);
    else console.log("<UART>", "Unknown queue item " + JSON.stringify(q));
  }
}

const uart = new Uart();

export { uart };
