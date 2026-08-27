import { trackWebSocketConnected, trackWebSocketError } from './analytics';

const PING_INTERVAL_MS = 3000;
const LIVENESS_TIMEOUT_MS = 10000;
const RECONNECT_DELAY_MS = 3000;
const ACK_TIMEOUT_MS = 2500;

class WebSocketService {
  constructor() {
    this.socket = null;
    this.onMessageCallback = null;
    this.onJoinRoomCallback = null; // Add callback for join room
    this.onConnectCallback = null; // Fired once the socket connection is established
    this.onDisconnectCallback = null; // Fired on graceful disconnect or socket close
    this.connectionStartTime = null;
    this.roomCallback = null; // Kept so a reconnect can re-subscribe to the room
    this.roomId = null;
    // Room events can arrive between the server seating us and React
    // attaching the room callback (simultaneous joins make this window real);
    // buffer them instead of dropping them
    this.pendingRoomMessages = [];
    this.username = null;
    this.explicitDisconnect = false;
    this.pingTimer = null;
    this.livenessTimer = null;
    this.lastMessageAt = null;
    this.pendingAcks = new Map(); // moveId -> { resolve, reject, timeoutId }
    // Deliberately in-memory only (per page load): a reconnect of the same
    // page keeps this id, while a duplicated tab (which clones sessionStorage)
    // gets a fresh one - lets the server tell the two cases apart.
    this.tabId = crypto.randomUUID();
  }

  get connected() {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  connect(username) {
    this.explicitDisconnect = false;
    this.connectionStartTime = Date.now();
    this.username = encodeURIComponent(username);
    this._openSocket();
  }

  _buildUrl() {
    const isProd = import.meta.env.PROD;
    const base = isProd
      ? `${window.location.protocol === 'https:' ? 'wss://' : 'ws://'}${window.location.host}`
      : 'ws://localhost:8080';
    return `${base}/ws?username=${this.username}&tab=${this.tabId}`;
  }

  _openSocket() {
    const url = this._buildUrl();
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      console.log('WebSocket connection open');

      if (this.connectionStartTime) {
        const connectionTime = Date.now() - this.connectionStartTime;
        trackWebSocketConnected(connectionTime);
      }

      this._touchLiveness();
      this._startHeartbeat();

      if (this.onConnectCallback) {
        this.onConnectCallback();
      }

      // The server does not remember subscriptions across a reconnect, so
      // re-join the room server-side if we had one
      if (this.roomId && this.roomCallback) {
        this._sendRaw({ type: 'join', roomId: this.roomId });
      }
    };

    socket.onmessage = (event) => {
      this._touchLiveness();
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
        return;
      }
      console.log('[ws] - Received message:', data);
      this._dispatch(data);
    };

    socket.onclose = () => {
      this._onSocketGone(socket);
    };

    socket.onerror = (event) => {
      console.error('WebSocket error', event);
      trackWebSocketError('websocket_error');
    };
  }

  // Idempotent teardown for a socket that is gone (closed, or forced closed
  // by the liveness timeout). Chromium defers the actual close event while
  // offline, so the liveness timeout calls this directly instead of waiting
  // for onclose to eventually fire.
  _onSocketGone(socket) {
    if (socket._handledGone) return;
    socket._handledGone = true;
    console.log('WebSocket connection closed');
    if (this.socket === socket) {
      this._stopHeartbeat();
      this._rejectAllPending('connection closed');
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback();
      }
      if (!this.explicitDisconnect) {
        setTimeout(() => {
          if (!this.explicitDisconnect && this.socket === socket) {
            this._openSocket();
          }
        }, RECONNECT_DELAY_MS);
      }
    }
  }

  _dispatch(data) {
    switch (data.type) {
      case 'welcome':
        // The server may rename a duplicated-tab identity; adopt it so
        // reconnects and sends use the effective username
        if (data.username) {
          this.username = encodeURIComponent(data.username);
        }
        if (this.onMessageCallback) this.onMessageCallback(data);
        break;
      case 'room_created':
      case 'active_players':
        if (this.onMessageCallback) this.onMessageCallback(data);
        break;
      case 'room_joined':
        if (this.onJoinRoomCallback) this.onJoinRoomCallback(data);
        break;
      case 'player_joined':
      case 'player_disconnected':
        this._deliverRoomMessage(data);
        break;
      case 'game_state':
        this._deliverRoomMessage({ type: 'game_state_updated', gameState: data.gameState });
        break;
      case 'ack':
        this._resolveAck(data.moveId);
        break;
      case 'pong':
        // liveness already updated above
        break;
      default:
        break;
    }
  }

  _touchLiveness() {
    this.lastMessageAt = Date.now();
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.pingTimer = setInterval(() => {
      this._sendRaw({ type: 'ping' });
    }, PING_INTERVAL_MS);
    this.livenessTimer = setInterval(() => {
      if (this.lastMessageAt && Date.now() - this.lastMessageAt > LIVENESS_TIMEOUT_MS) {
        console.log('WebSocket liveness timeout, forcing close');
        const socket = this.socket;
        if (socket) {
          try {
            socket.close();
          } catch (e) {
            // ignore
          }
          // The close event can be deferred indefinitely (e.g. while the
          // network is offline), so tear down immediately rather than
          // waiting for onclose.
          this._onSocketGone(socket);
        }
      }
    }, PING_INTERVAL_MS);
  }

  _stopHeartbeat() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.livenessTimer) clearInterval(this.livenessTimer);
    this.pingTimer = null;
    this.livenessTimer = null;
  }

  _sendRaw(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    try {
      this.socket.send(JSON.stringify(payload));
      return true;
    } catch (e) {
      return false;
    }
  }

  _resolveAck(moveId) {
    const pending = this.pendingAcks.get(moveId);
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    this.pendingAcks.delete(moveId);
    pending.resolve();
  }

  _rejectAllPending(reason) {
    this.pendingAcks.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(reason));
    });
    this.pendingAcks.clear();
  }

  disconnect() {
    this.explicitDisconnect = true;
    this._stopHeartbeat();
    this._rejectAllPending('disconnected');
    this.roomId = null;
    this.roomCallback = null;
    if (this.socket) {
      this.socket.close();
    }
  }

  _deliverRoomMessage(message) {
    if (this.roomCallback) {
      this.roomCallback(message);
    } else if (this.pendingRoomMessages.length < 20) {
      this.pendingRoomMessages.push(message);
    }
  }

  subscribe(roomId, callback) {
    this.roomId = roomId;
    this.roomCallback = callback;
    const buffered = this.pendingRoomMessages;
    this.pendingRoomMessages = [];
    buffered.forEach((message) => callback(message));
  }

  sendMove(roomId, gameState) {
    if (!this.connected) {
      return Promise.reject(new Error('not connected'));
    }
    const moveId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingAcks.delete(moveId);
        reject(new Error('move ack timeout'));
      }, ACK_TIMEOUT_MS);
      this.pendingAcks.set(moveId, { resolve, reject, timeoutId });
      const sent = this._sendRaw({ type: 'move', roomId, moveId, gameState });
      if (!sent) {
        clearTimeout(timeoutId);
        this.pendingAcks.delete(moveId);
        reject(new Error('send failed'));
      }
    });
  }

  createRoom(username, roomId) {
    if (!this.connected) return;
    this._sendRaw({ type: 'create', roomId });
  }

  joinRoom(roomId) {
    if (!this.connected) return;
    this._sendRaw({ type: 'join', roomId });
  }

  setOnMessageCallback(callback) {
    this.onMessageCallback = callback;
  }

  setOnJoinRoomCallback(callback) {
    this.onJoinRoomCallback = callback;
  }

  setOnConnectCallback(callback) {
    this.onConnectCallback = callback;
  }

  setOnDisconnectCallback(callback) {
    this.onDisconnectCallback = callback;
  }
}

export const webSocketService = new WebSocketService();
