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

export interface UART {
  debug: number;
  flowControl: boolean;
  log: (level: number, s: string) => void;
  writeProgress: (charsSent?: any, charsTotal?: any) => void;
  connect: any;
  write: any;
  eval: any;
  setTime: (cb: Function) => void;
  isConnected: () => boolean;
  getConnection: () => any;
  close: () => void;
  modal: (callback: Function) => void;
}

export interface MSStreamType {
  type: string;
  msClose(): void;
  msDetachStream(): any;
}
