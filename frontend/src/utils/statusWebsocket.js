const PING_INTERVAL_MS = 3000;
const LIVENESS_TIMEOUT_MS = 10000;
const RECONNECT_DELAY_MS = 3000;

class StatusWebSocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.onConnectCallback = null;
        this.onDisconnectCallback = null;
        this.connectionStartTime = null;
        this.subscriptions = new Map(); // topic -> callback
        this.statusId = null;
        this.explicitDisconnect = false;
        this.pingTimer = null;
        this.livenessTimer = null;
        this.lastMessageAt = null;
    }

    connect() {
        // Prevent duplicate connections
        if (this.socket && this.connected) {
            console.log('Status WebSocket already connected, reusing existing connection');
            return this.statusId;
        }

        // Disconnect existing socket if any
        if (this.socket) {
            this.socket.close();
        }

        this.explicitDisconnect = false;
        this.connectionStartTime = Date.now();
        // Use a special identifier for status monitoring connections
        this.statusId = `status_monitor_${Date.now()}`;

        this._openSocket();

        return this.statusId;
    }

    _buildUrl() {
        const isProd = import.meta.env.PROD;
        const base = isProd
            ? `${window.location.protocol === 'https:' ? 'wss://' : 'ws://'}${window.location.host}`
            : 'ws://localhost:8080';
        return `${base}/ws?username=${encodeURIComponent(this.statusId)}&type=status`;
    }

    _openSocket() {
        const url = this._buildUrl();
        const socket = new WebSocket(url);
        this.socket = socket;

        socket.onopen = () => {
            console.log('Status WebSocket connection open');
            this.connected = true;
            this._touchLiveness();
            this._startHeartbeat();

            if (this.onConnectCallback) {
                this.onConnectCallback();
            }
        };

        socket.onmessage = (event) => {
            this._touchLiveness();
            let data;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                console.error('Failed to parse status WebSocket message', e);
                return;
            }
            console.log('[STATUS ws] - Received message:', data);
            if (data.type === 'status_update') {
                const callback = this.subscriptions.get('/topic/status');
                if (callback) {
                    callback({ type: 'game_state_update', rooms: data.rooms });
                }
            }
        };

        socket.onclose = () => {
            this._onSocketGone(socket);
        };

        socket.onerror = (event) => {
            console.error('Status WebSocket error', event);
        };
    }

    // Idempotent teardown for a socket that is gone (closed, or forced closed
    // by the liveness timeout). Chromium defers the actual close event while
    // offline, so the liveness timeout calls this directly instead of waiting
    // for onclose to eventually fire.
    _onSocketGone(socket) {
        if (socket._handledGone) return;
        socket._handledGone = true;
        console.log('Status WebSocket disconnected');
        if (this.socket === socket) {
            this.connected = false;
            this._stopHeartbeat();
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
                console.log('Status WebSocket liveness timeout, forcing close');
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

    disconnect() {
        this.explicitDisconnect = true;
        this._stopHeartbeat();
        if (this.socket && this.connected) {
            // Unsubscribe from all active subscriptions
            this.subscriptions.forEach((callback, topic) => {
                console.log('Status: Cleaned up subscription for:', topic);
            });
            this.subscriptions.clear();

            this.socket.close();
            console.log('Status WebSocket disconnected and cleaned up');
        }
    }

    subscribe(topic, callback) {
        if (!this.socket || !this.connected) {
            console.warn('Status WebSocket not connected, cannot subscribe to:', topic);
            return null;
        }

        // Check if already subscribed to this topic
        if (this.subscriptions.has(topic)) {
            console.log('Status: Already subscribed to:', topic);
            return this.subscriptions.get(topic);
        }

        this.subscriptions.set(topic, callback);
        console.log('Status: Subscribed to:', topic);
        return callback;
    }

    unsubscribe(topic) {
        if (this.subscriptions.has(topic)) {
            this.subscriptions.delete(topic);
            console.log('Status: Unsubscribed from:', topic);
        }
    }

    // Get current connection status
    isConnected() {
        return this.connected;
    }

    // Get active subscriptions
    getActiveSubscriptions() {
        return Array.from(this.subscriptions.keys());
    }

    setOnConnectCallback(callback) {
        this.onConnectCallback = callback;
    }

    setOnDisconnectCallback(callback) {
        this.onDisconnectCallback = callback;
    }
}

export const statusWebSocketService = new StatusWebSocketService();
