export class SerialPortInstance {
  onconnect!: EventHandler;
  ondisconnect!: EventHandler;
  readable!: ReadableStream<any>;
  writable: any = {
    locked: false,
    abort: function (reason?: any): Promise<void> {
      throw new Error("Function not implemented.");
    },
    close: function (): Promise<void> {
      throw new Error("Function not implemented.");
    },
    getWriter: function (): FakeWriter {
      return new FakeWriter();
    },
  };
  open(options: SerialOptions): Promise<void> {
    throw new Error("Method not implemented.");
  }
  close(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getInfo(): Partial<SerialPortInfo> {
    throw new Error("Method not implemented.");
  }
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions | undefined
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
}

class FakeWriter {
  async write(data: string) {
    console.log(data);
    return new Promise((resolve) => {
      resolve(data);
    });
  }
}
