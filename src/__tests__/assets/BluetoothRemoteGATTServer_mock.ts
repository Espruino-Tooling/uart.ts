import {
  DeviceMock,
  GattMock,
  PrimaryServiceMock,
  WebBluetoothMock,
} from "web-bluetooth-mock";
import { SerialPortInstance } from "./serialPort_mock";

PrimaryServiceMock.prototype.device = {} as any;

export class BluetoothRemoteGATTServerInstance implements GattMock {
  public addEventListener(event: string, listener: (e: Event) => void): void {
    throw new Error("Method not implemented.");
  }
  public removeEventListener(
    event: string,
    listener: (e: Event) => void
  ): void {
    throw new Error("Method not implemented.");
  }
  public dispatchEvent(event: Event): boolean {
    throw new Error("Method not implemented.");
  }
  device!: NewDeviceMock;
  connected!: boolean;
  connect(): Promise<any> {
    throw new Error("Method not implemented.");
  }
  disconnect(): void {
    console.log("disconnected");
  }
  getPrimaryService(service: BluetoothServiceUUID): Promise<any> {
    return new Promise((resolve) =>
      resolve({
        getCharacteristic(data: string) {
          return {
            writeValue(): Promise<void> {
              return new Promise((resolve) => resolve());
            },
          };
        },
      })
    );
  }
  getPrimaryServices(
    service?: BluetoothServiceUUID | undefined
  ): Promise<any[]> {
    return new Promise((resolve) => resolve([]));
  }
}

export class NewDeviceMock extends DeviceMock {
  gatt: any = new (class {
    device!: any;
    connected!: boolean;
    constructor(device?: any) {
      this.device = {} as any;
    }
    connect?(): Promise<BluetoothRemoteGATTCharacteristicInstance> {
      return new Promise((resolve) =>
        resolve(new BluetoothRemoteGATTCharacteristicInstance())
      );
    }
    disconnect?() {
      console.log("disconnected");
      return true;
    }
    getPrimaryService?(service: BluetoothServiceUUID): Promise<any> {
      return new Promise((resolve) =>
        resolve({
          getCharacteristic(data: string) {
            return {
              writeValue(): Promise<void> {
                return new Promise((resolve) => resolve());
              },
            };
          },
        })
      );
    }
    getPrimaryServices?(service?: BluetoothServiceUUID): Promise<any[]>;
  })();
}

class BluetoothRemoteGATTCharacteristicInstance
  implements BluetoothRemoteGATTCharacteristic
{
  disconnect() {
    console.log("<UART> Disconnected");
  }
  getPrimaryService(service: BluetoothServiceUUID): Promise<any> {
    return new Promise((resolve) =>
      resolve({
        getCharacteristic(data: string) {
          return {
            addEventListener(data: string, func: Function) {
              return true;
            },
            startNotifications() {},
            writeValue(data?: any): Promise<any> {
              return new Promise((resolve) => {
                resolve(data);
              });
            },
          };
        },
      })
    );
  }
  service!: BluetoothRemoteGATTService;
  uuid!: string;
  properties!: BluetoothCharacteristicProperties;
  value?: DataView | undefined;
  getDescriptor(
    descriptor: BluetoothDescriptorUUID
  ): Promise<BluetoothRemoteGATTDescriptor> {
    throw new Error("Method not implemented.");
  }
  getDescriptors(
    descriptor?: BluetoothDescriptorUUID | undefined
  ): Promise<BluetoothRemoteGATTDescriptor[]> {
    throw new Error("Method not implemented.");
  }
  readValue(): Promise<DataView> {
    throw new Error("Method not implemented.");
  }
  writeValue(value: BufferSource): Promise<void> {
    throw new Error("Method not implemented.");
  }
  writeValueWithResponse(value: BufferSource): Promise<void> {
    throw new Error("Method not implemented.");
  }
  writeValueWithoutResponse(value: BufferSource): Promise<void> {
    throw new Error("Method not implemented.");
  }
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic> {
    throw new Error("Method not implemented.");
  }
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic> {
    throw new Error("Method not implemented.");
  }
  addEventListener(
    type: "characteristicvaluechanged",
    listener: (this: this, ev: Event) => any,
    useCapture?: boolean | undefined
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    useCapture?: boolean | undefined
  ): void;
  addEventListener(
    type: unknown,
    listener: unknown,
    useCapture?: unknown
  ): void {
    throw new Error("Method not implemented.");
  }
  dispatchEvent(event: Event): boolean {
    throw new Error("Method not implemented.");
  }
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions | undefined
  ): void {
    throw new Error("Method not implemented.");
  }
  oncharacteristicvaluechanged!: (this: this, ev: Event) => any;
}

export class BluetoothDeviceInstance implements BluetoothDevice {
  constructor() {
    this.id = "12341";
    this.name = "puck.js";
  }

  id!: string;
  name?: string | undefined;
  gatt?: BluetoothRemoteGATTServer | undefined;
  forget(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  watchAdvertisements(
    options?: WatchAdvertisementsOptions | undefined
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  unwatchAdvertisements(): void {
    throw new Error("Method not implemented.");
  }
  watchingAdvertisements!: boolean;
  addEventListener(
    type: "gattserverdisconnected",
    listener: (this: this, ev: Event) => any,
    useCapture?: boolean | undefined
  ): void;
  addEventListener(
    type: "advertisementreceived",
    listener: (this: this, ev: BluetoothAdvertisingEvent) => any,
    useCapture?: boolean | undefined
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    useCapture?: boolean | undefined
  ): void;
  addEventListener(
    type: unknown,
    listener: unknown,
    useCapture?: unknown
  ): void {
    throw new Error("Method not implemented.");
  }
  dispatchEvent(event: Event): boolean {
    throw new Error("Method not implemented.");
  }
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions | undefined
  ): void {
    throw new Error("Method not implemented.");
  }
  onadvertisementreceived!: (this: this, ev: BluetoothAdvertisingEvent) => any;
  ongattserverdisconnected!: (this: this, ev: Event) => any;
  oncharacteristicvaluechanged!: (this: this, ev: Event) => any;
  onserviceadded!: (this: this, ev: Event) => any;
  onservicechanged!: (this: this, ev: Event) => any;
  onserviceremoved!: (this: this, ev: Event) => any;
}

function createDevice() {
  const device = new NewDeviceMock("puck.js", [0xffe0]);
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
  return device;
}

export class MockWB extends WebBluetoothMock {
  requestDevice(options: RequestDeviceOptions): Promise<NewDeviceMock> {
    return new Promise((resolve) => resolve(createDevice()));
  }
}

export class MockPort {
  open() {
    return new Promise<void>((resolve) => resolve());
  }
}
