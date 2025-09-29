import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

class StatusWebSocketService {
    constructor() {
        this.client = null;
        this.connected = false;
        this.onConnectCallback = null;
        this.onDisconnectCallback = null;
        this.connectionStartTime = null;
        this.subscriptions = new Map();
    }

    connect() {
        // Prevent duplicate connections
        if (this.client && this.connected) {
            console.log('Status WebSocket already connected, reusing existing connection');
            return;
        }

        // Disconnect existing client if any
        if (this.client) {
            this.client.deactivate();
        }

        this.connectionStartTime = Date.now();
        // Use a special identifier for status monitoring connections
        const statusId = `status_monitor_${Date.now()}`;

        this.client = new Client({
            connectHeaders: {
                username: statusId,
                connectionType: 'status_monitor', // Special header to identify status connections
            },
            disconnectHeaders: {
                username: statusId,
            },
            debug: (str) => {
                console.log("[STATUS STOMP DEBUG] - " + str);
            },
            reconnectDelay: 3000,
            heartbeatIncoming: 2000,
            heartbeatOutgoing: 2000,
            webSocketFactory: () => {
                const isProd = process.env.NODE_ENV === 'production';
                const host = isProd ? window.location.hostname : 'localhost:8080';
                const url = `${isProd ? "https" : "http"}://${host}/ws?username=${statusId}&type=status`;
                const socket = new SockJS(url);
                socket.onopen = () => console.log('Status SockJS connection open');
                return socket;
            },
            onConnect: (frame) => {
                this.connected = true;
                console.log('Status WebSocket connected for monitoring');

                // Call connection callback if set
                if (this.onConnectCallback) {
                    this.onConnectCallback();
                }
            },
            onDisconnect: (frame) => {
                this.connected = false;
                console.log('Status WebSocket disconnected');

                // Call disconnect callback if set
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback();
                }
            },
            onStompError: (frame) => {
                console.error('Status WebSocket error: ' + frame.headers['message']);
                console.error('Additional details: ' + frame.body);
            },
        });

        this.client.activate();
    }

    disconnect() {
        if (this.client && this.connected) {
            // Unsubscribe from all active subscriptions
            this.subscriptions.forEach((subscription, topic) => {
                subscription.unsubscribe();
                console.log('Status: Cleaned up subscription for:', topic);
            });
            this.subscriptions.clear();

            this.client.deactivate();
            console.log('Status WebSocket disconnected and cleaned up');
        }
    }

    subscribe(topic, callback) {
        if (!this.client || !this.connected) {
            console.warn('Status WebSocket not connected, cannot subscribe to:', topic);
            return null;
        }

        // Check if already subscribed to this topic
        if (this.subscriptions.has(topic)) {
            console.log('Status: Already subscribed to:', topic);
            return this.subscriptions.get(topic);
        }

        const subscription = this.client.subscribe(topic, (message) => {
            const data = JSON.parse(message.body);
            console.log(`[STATUS ${topic}] - Received message:`, data);
            callback(data);
        });

        // Store subscription for cleanup
        this.subscriptions.set(topic, subscription);
        console.log('Status: Subscribed to:', topic);
        return subscription;
    }

    unsubscribe(topic) {
        const subscription = this.subscriptions.get(topic);
        if (subscription) {
            subscription.unsubscribe();
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