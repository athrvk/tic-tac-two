import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { trackWebSocketConnected, trackWebSocketError } from './analytics';

class WebSocketService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.onMessageCallback = null;
    this.onJoinRoomCallback = null; // Add callback for join room
    this.connectionStartTime = null;
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
      this.client.deactivate();
    }
  }

  subscribe(roomId, callback) {
    if (!this.client || !this.connected) return;
    this.client.subscribe(`/topic/room/${roomId}`, (message) => {
      const data = JSON.parse(message.body);
      console.log(`[/topic/room/${roomId}] - Received message:`, data);
      callback(data);
    });
    this.roomId = roomId;
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
}

export const webSocketService = new WebSocketService();