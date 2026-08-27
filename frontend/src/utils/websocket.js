import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { trackWebSocketConnected, trackWebSocketError } from './analytics';

class WebSocketService {
  constructor() {
    this.client = null;
    this.onMessageCallback = null;
    this.onJoinRoomCallback = null; // Add callback for join room
    this.onConnectCallback = null; // Fired once the STOMP session is established
    this.onDisconnectCallback = null; // Fired on graceful disconnect or socket close
    this.connectionStartTime = null;
    this.roomCallback = null; // Kept so a reconnect can re-subscribe to the room
    this.roomSubscription = null;
  }

  // onDisconnect only fires for graceful disconnects (stompjs v7), so this
  // getter is the source of truth for connection state instead of a mirrored field
  get connected() {
    return !!this.client && this.client.connected;
  }

  connect(username) {
    this.connectionStartTime = Date.now();
    this.username = encodeURIComponent(username);
    this.client = new Client({
      // brokerURL: `ws://localhost:8080/ws`, // Update with backend WebSocket endpoint if different
      connectHeaders: {
        username: this.username,
        // Add headers if needed
      },
      disconnectHeaders: {
        username: this.username,
      },
      logRawCommunication: true, // Enable raw communication logging
      debug: (str) => {
        console.log("[STOMP DEBUG] - " + str);
      },
      reconnectDelay: 3000,
      heartbeatIncoming: 2000,
      heartbeatOutgoing: 2000,
      webSocketFactory: () => {
        const isProd = process.env.NODE_ENV === 'production';
        // In production the app is served same-origin by the backend, so keep
        // scheme and host:port from the page (works on any domain and port)
        const base = isProd
          ? `${window.location.protocol}//${window.location.host}`
          : 'http://localhost:8080';
        const url = `${base}/ws?username=${this.username}`;
        const socket = new SockJS(url); // Update with backend URL
        socket.onopen = () => console.log('SockJS connection open');
        return socket;
      }, // Update with backend URL
      onConnect: (frame) => {
        console.log('STOMP connected as : ' + username);
        
        // Track successful WebSocket connection
        if (this.connectionStartTime) {
          const connectionTime = Date.now() - this.connectionStartTime;
          trackWebSocketConnected(connectionTime);
        }
        
        // Subscribe to public topic for room events
        this.client.subscribe('/topic/public', (message) => {
          const data = JSON.parse(message.body);
          console.log("[/topic/public] - Received message:", data);
          if (this.onMessageCallback) {
            this.onMessageCallback(data);
          }
        });
        // Subscribe to user-specific queue for join room responses
        this.client.subscribe(`/user/queue/join`, (message) => {
          const data = JSON.parse(message.body);
          console.log(`[/user/queue/join] - Received message:`, data);
          if (this.onJoinRoomCallback) {
            this.onJoinRoomCallback(data);
          }
        });
        // Room creation confirmations are sent only to the creator
        this.client.subscribe(`/user/queue/roomCreated`, (message) => {
          const data = JSON.parse(message.body);
          console.log(`[/user/queue/roomCreated] - Received message:`, data);
          if (this.onMessageCallback) {
            this.onMessageCallback(data);
          }
        });
        if (this.onConnectCallback) {
          this.onConnectCallback();
        }
        // stompjs does not restore subscriptions across a reconnect, so
        // re-subscribe and re-join the room server-side if we had one
        if (this.roomId && this.roomCallback) {
          this.subscribe(this.roomId, this.roomCallback);
          this.joinRoom(this.roomId);
        }
      },
      onDisconnect: (frame) => {
        console.log('WebSocket disconnected: ' + username);
        if (this.onDisconnectCallback) {
          this.onDisconnectCallback();
        }
      },
      onWebSocketClose: (event) => {
        console.log('WebSocket connection closed');
        if (this.onDisconnectCallback) {
          this.onDisconnectCallback();
        }
      },
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
        
        // Track WebSocket errors
        const errorType = frame.headers['message'] || 'unknown_error';
        trackWebSocketError(errorType);
      },
    });

    this.client.activate();
  }

  disconnect() {
    // Deactivate even while disconnected - a client mid-reconnect would
    // otherwise keep retrying forever
    if (this.client) {
      this.client.deactivate();
    }
  }

  subscribe(roomId, callback) {
    if (!this.client || !this.connected) return;
    if (this.roomSubscription) {
      try {
        this.roomSubscription.unsubscribe();
      } catch (e) {
        // Previous subscription may belong to a dead connection
      }
    }
    this.roomSubscription = this.client.subscribe(`/topic/room/${roomId}`, (message) => {
      const data = JSON.parse(message.body);
      console.log(`[/topic/room/${roomId}] - Received message:`, data);
      callback(data);
    });
    this.roomId = roomId;
    this.roomCallback = callback;
  }

  sendGameState(roomId, gameState) {
    if (!this.client || !this.connected) return false;
    try {
      this.client.publish({
        destination: `/app/updateGameState`,
        body: JSON.stringify({ roomId, gameState }),
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  createRoom(username, roomId) { // Accept username as parameter
    if (!this.client || !this.connected) return;
    this.client.publish({
      destination: '/app/createRoom',
      body: JSON.stringify({ username, roomId }), // Send username to backend
    });
  }

  joinRoom(roomId) { // Accept username as parameter
    if (!this.client || !this.connected) return;
    this.client.publish({
      destination: '/app/joinRoom',
      body: JSON.stringify({ roomId }), // Send roomId and username to backend
    });
  }

  setOnMessageCallback(callback) {
    this.onMessageCallback = callback;
  }

  setOnJoinRoomCallback(callback) { // Add method to set join room callback
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