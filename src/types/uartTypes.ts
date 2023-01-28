export interface Connection {
  isOpening: boolean;
  isOpen: boolean;
  received: string;
  txInProgress: boolean;
  cb?: Function | undefined;
  hadData?: boolean | undefined;
  close(callback?: Function): void;
  emit(evt: string, data?: string): void;
  write(data?: string, callback?: Function): void;
  on(name: string, action: Function): void;
}

export interface Queue {
  type: string;
  data?: string;
  expr?: string;
  cb?: Function | undefined;
  callback?: Function | undefined;
  callbackNewline?: boolean | undefined;
}

export interface Endpoint {
  name: string;
  description: string;
  svg: string;
  isSupported: () => boolean | string;
  connect: (connection: Connection, callback: Function) => any;
}

export interface UART {
  connect: (callback: Function) => any;
  write: any;
  eval: any;
  isBusy: boolean;
  setTime: (cb: Function) => void;
  isConnected: () => boolean;
  getConnection: () => any;
  close: () => void;
  getWrittenData: () => Promise<any>;
  // modal: (callback: Function) => void;
}

export interface MSStreamType {
  type: string;
  msClose(): void;
  msDetachStream(): any;
}
