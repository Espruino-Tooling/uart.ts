import { WebBluetoothMock, DeviceMock } from "web-bluetooth-mock";
import { JSDOM } from "jsdom";
import { uart as UART } from "../uart";
import { Serializer } from "v8";

const dom = new JSDOM(`<!doctype html><html><body></body></html>`);

global.document = dom.window.document;
global.window = dom.window as any;
global.navigator = global.window.navigator;

describe("connectToDevice", () => {
  it("should connect to bluetooth device", async () => {
    const device = new DeviceMock("puck.js", [0xffe0]);
    global.navigator = global.navigator || {};
    global.navigator.bluetooth = new WebBluetoothMock([device]) as any;

    Object.defineProperty(global, "navigator", {
      value: {
        ...global.navigator,
        platform: ["Win"],
        userAgent: ["Chrome/57"],
        serial: new Serializer(),
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
