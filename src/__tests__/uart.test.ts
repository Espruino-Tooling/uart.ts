import { WebBluetoothMock, DeviceMock, GattMock } from "web-bluetooth-mock";
import { JSDOM } from "jsdom";
import { uart as UART } from "../uart";
import { SerialPortInstance } from "./assets/serialPort_mock";
import {
  BluetoothDeviceInstance,
  BluetoothRemoteGATTServerInstance,
  MockPort,
  MockWB,
  NewDeviceMock,
} from "./assets/BluetoothRemoteGATTServer_mock";

const dom = new JSDOM(`<!doctype html><html><body></body></html>`);

global.document = dom.window.document;
global.window = dom.window as any;
global.navigator = global.window.navigator;

describe("connectToDevice", () => {
  it("should connect to bluetooth device", async () => {
    const device = new DeviceMock("puck.js", [0xffe0]);
    global.navigator = global.navigator || {};
    global.navigator.bluetooth = new MockWB([device]) as any;

    Object.defineProperty(global, "navigator", {
      value: {
        ...global.navigator,
        platform: ["Win"],
        userAgent: ["Chrome/57"],
        serial: new SerialPortInstance(),
      },
      writable: true,
    });
    jest.spyOn(device.gatt, "connect");

    const p = new Promise((resolve) => {
      UART.write("{}");
      setTimeout(() => {
        resolve("");
      }, 100);
    }).catch((err) => {
      throw new Error(err);
    });

    await p
      .then(() => {
        let connect_btn = dom.window.document.getElementsByClassName(
          "endpoints-0-0-3"
        )[0] as HTMLElement;

        connect_btn.click();

        expect(device.gatt.connect).toHaveBeenCalled();
      })
      .catch(() => {
        expect(false);
      });
  });
});

describe("writeToDevice", () => {
  it("should be able to write to the device", async () => {
    const device = new NewDeviceMock("puck.js", [0xffe0]);
    global.navigator = global.navigator || {};
    global.navigator.bluetooth = new MockWB([device]) as any;

    Object.defineProperty(global, "navigator", {
      value: {
        ...global.navigator,
        platform: ["Win"],
        userAgent: ["Chrome/57"],
        serial: {
          requestPort(): Promise<MockPort> {
            return new Promise((resolve) => resolve(new MockPort()));
          },
        },
      },
      writable: true,
    });

    let sent_str = "console.log('hello')";

    const p = new Promise((resolve) => {
      UART.write(sent_str);
      setTimeout(() => {
        resolve("");
      }, 1000);
    }).catch((err) => {
      throw new Error(err);
    });

    const clenseData = (data: string) => {
      let data_arr = data.replace('""', ",").split(",");
      return data_arr[1].slice(0, -1);
    };

    await p.then(() => {
      UART.getWrittenData().then((data: string) =>
        expect(clenseData(data)).toBe(sent_str)
      );
    });
  });
});
