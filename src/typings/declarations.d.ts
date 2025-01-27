declare module "aria-query" {
  export type ARIARole = string;
}

declare module "ws" {
  interface WebSocketOptions {
    protocol?: string | string[];
    handshakeTimeout?: number;
    perMessageDeflate?: boolean | object;
    maxPayload?: number;
    followRedirects?: boolean;
    headers?: { [key: string]: string };
    agent?: import("http").Agent | import("https").Agent;
    rejectUnauthorized?: boolean;
  }

  class WebSocket {
    constructor(address: string, options?: WebSocketOptions);
  }
  export = WebSocket;
}
