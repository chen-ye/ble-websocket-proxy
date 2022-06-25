export class WebSocketManager {
  bleConnections: Set<WebSocketP> = new Set();
  gameConnections: Set<WebSocketP> = new Set();
  rawBleConnections: Map<string, WebSocketP> = new Map();
  rawGameConnections: Map<string, WebSocketP> = new Map();

  constructor() {
    this._handleBleMessage = this._handleBleMessage.bind(this);
    this._handleGameMessage = this._handleGameMessage.bind(this);
  }

  async addBleConnection(wsp: WebSocketP) {
    wsp.ws.addEventListener('message', this._handleBleMessage);

    await wsp.opened;
    this.bleConnections.add(wsp);

    wsp.closed.then(() => {
      this.bleConnections.delete(wsp);
    });
  }

  async addGameConnection(wsp: WebSocketP) {
    wsp.ws.addEventListener('message', this._handleGameMessage);

    await wsp.opened;
    this.gameConnections.add(wsp);

    wsp.closed.then(() => {
      this.gameConnections.delete(wsp);
    });
  }

  async addRawBleConnection(wsp: WebSocketP, type: string) {
    wsp.ws.addEventListener('message', (evt) =>
      this._handleRawBleMessage(evt, type),
    );

    await wsp.opened;

    this.rawBleConnections.set(type, wsp);
    wsp.closed.then(() => {
      this.rawBleConnections.delete(type);
    });
  }

  async addRawGameConnection(wsp: WebSocketP, type: string) {
    wsp.ws.addEventListener('message', (evt) =>
      this._handleRawGameMessage(evt, type),
    );

    await wsp.opened;

    this.rawGameConnections.set(type, wsp);
    wsp.closed.then(() => {
      this.rawGameConnections.delete(type);
    });
  }

  _handleBleMessage(evt: MessageEvent) {
    for (const gameConnection of this.gameConnections) {
      gameConnection.ws.send(evt.data);
    }
  }

  _handleGameMessage(evt: MessageEvent) {
    for (const bleConnection of this.bleConnections) {
      bleConnection.ws.send(evt.data);
    }
  }

  _handleRawBleMessage(evt: MessageEvent, type: string) {
    const rawGameConnection = this.rawGameConnections.get(type);
    if (rawGameConnection) {
      rawGameConnection.ws.send(evt.data);
    }
  }

  _handleRawGameMessage(evt: MessageEvent, type: string) {
    const rawBleConnection = this.rawBleConnections.get(type);
    if (rawBleConnection) {
      rawBleConnection.ws.send(evt.data);
    }
  }
}

export class WebSocketP {
  #ws: WebSocket;
  opened: Promise<void>;
  #resolveOpened?: () => void;
  #rejectOpened?: (e: Error) => void;
  closed: Promise<void>;
  #resolveClosed?: () => void;

  constructor(ws: WebSocket) {
    this.#ws = ws;
    this.opened = new Promise((resolve, reject) => {
      this.#resolveOpened = resolve;
      this.#rejectOpened = reject;
    });
    this.closed = new Promise((resolve) => {
      this.#resolveClosed = resolve;
    });

    if (
      ws.readyState === WebSocket.CLOSED ||
      ws.readyState === WebSocket.CLOSING
    ) {
      this.#rejectOpened?.(
        new Error(
          `Cannot add connection: Invalid readyState '${ws.readyState}' for WebSocket '${ws.url}'`,
        ),
      );
      this.#resolveClosed?.();
    }

    ws.addEventListener('open', () => this.#resolveOpened?.());
    ws.addEventListener('close', () => this.#resolveClosed?.());
  }

  get ws() {
    return this.#ws;
  }

  close() {
    this.#ws.close();
    return this.closed;
  }
}
