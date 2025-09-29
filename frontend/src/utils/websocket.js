import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { trackWebSocketConnected, trackWebSocketError } from './analytics';

class WebSocketService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.onMessageCallback = null;
    this.onJoinRoomCallback = null; // Add callback for join room
    this.onConnectCallback = null;
    this.onDisconnectCallback = null;
    this.connectionStartTime = null;
    this.subscriptions = new Map(); // Track active subscriptions
  }

  connect(username) {
    // Prevent duplicate connections
    if (this.client && this.connected) {
      console.log('WebSocket already connected, reusing existing connection');
      return;
    }

    // Disconnect existing client if any
    if (this.client) {
      this.client.deactivate();
    }

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
        const host = isProd ? window.location.hostname : 'localhost:8080';
        const url = `${isProd ? "https" : "http"}://${host}/ws?username=${this.username}`;
        const socket = new SockJS(url); // Update with backend URL
        socket.onopen = () => console.log('SockJS connection open');
        return socket;
      }, // Update with backend URL
      onConnect: (frame) => {
        this.connected = true;
        console.log('STOMP connected as : ' + username);
        
        // Track successful WebSocket connection
        if (this.connectionStartTime) {
          const connectionTime = Date.now() - this.connectionStartTime;
          trackWebSocketConnected(connectionTime);
        }
        
        // Call connection callback if set
        if (this.onConnectCallback) {
          this.onConnectCallback();
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
      },
      onDisconnect: (frame) => {
        this.connected = false;
        console.log('WebSocket disconnected: ' + username);

        // Call disconnect callback if set
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
    if (this.client && this.connected) {
      // Unsubscribe from all active subscriptions
      this.subscriptions.forEach((subscription, topic) => {
        subscription.unsubscribe();
        console.log('Cleaned up subscription for:', topic);
      });
      this.subscriptions.clear();

      this.client.deactivate();
      console.log('WebSocket disconnected and cleaned up');
    }
  }

  subscribe(topicOrRoomId, callback) {
    if (!this.client || !this.connected) {
      console.warn('WebSocket not connected, cannot subscribe to:', topicOrRoomId);
      return null;
    }

    // Determine the topic path
    let topic;
    if (topicOrRoomId.startsWith('/topic/')) {
      topic = topicOrRoomId;
    } else {
      topic = `/topic/room/${topicOrRoomId}`;
    }

    // Check if already subscribed to this topic
    if (this.subscriptions.has(topic)) {
      console.log('Already subscribed to:', topic);
      return this.subscriptions.get(topic);
    }

    const subscription = this.client.subscribe(topic, (message) => {
      const data = JSON.parse(message.body);
      console.log(`[${topic}] - Received message:`, data);
      callback(data);
    });

    // Store subscription for cleanup
    this.subscriptions.set(topic, subscription);

    if (!topicOrRoomId.startsWith('/topic/')) {
      this.roomId = topicOrRoomId;
    }

    console.log('Subscribed to:', topic);
    return subscription;
  }

  unsubscribe(topicOrRoomId) {
    let topic;
    if (topicOrRoomId.startsWith('/topic/')) {
      topic = topicOrRoomId;
    } else {
      topic = `/topic/room/${topicOrRoomId}`;
    }

    const subscription = this.subscriptions.get(topic);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(topic);
      console.log('Unsubscribed from:', topic);
    }
  }

  // Get current connection status
  isConnected() {
    return this.connected;
  }

  // Get current username
  getCurrentUsername() {
    return this.username ? decodeURIComponent(this.username) : null;
  }

  // Get active subscriptions
  getActiveSubscriptions() {
    return Array.from(this.subscriptions.keys());
  }

  sendGameState(roomId, gameState) {
    if (!this.client || !this.connected) return;
    this.client.publish({
      destination: `/app/updateGameState`,
      body: JSON.stringify({ roomId, gameState }),
    });
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