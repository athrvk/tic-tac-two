/**
 * Google Analytics 4 Event Tracking Utilities for Tic-Tac-Two
 * 
 * This module provides functions to track user interactions and game events
 * using Google Analytics 4 (GA4) with the gtag.js library.
 */

// Check if gtag is available (for development/testing environments)
const isGtagAvailable = () => typeof window !== 'undefined' && typeof window.gtag === 'function';

// Helper function to safely call gtag
const safeGtag = (...args) => {
  if (isGtagAvailable()) {
    try {
      window.gtag(...args);
    } catch (error) {
      console.warn('GA4 tracking error:', error);
    }
  } else {
    console.log('GA4 event (dev mode):', ...args);
  }
};

// Game Flow Events
export const trackGameStartIntent = (method) => {
  safeGtag('event', 'game_start_intent', {
    event_category: 'game',
    method: method, // 'create_room', 'join_room', 'random_match'
  });
};

export const trackRoomCreated = (roomType, playerCount = 1) => {
  safeGtag('event', 'room_created', {
    event_category: 'game',
    room_type: roomType, // 'private', 'public'
    player_count: playerCount,
  });
};

export const trackRoomJoined = (joinMethod, roomId) => {
  // Anonymize room ID by hashing or truncating
  const anonymizedRoomId = roomId ? roomId.substring(0, 8) + '...' : 'unknown';
  
  safeGtag('event', 'room_joined', {
    event_category: 'game',
    join_method: joinMethod, // 'room_code', 'random_match'
    room_id: anonymizedRoomId,
  });
};

export const trackGameStarted = (gameMode, playerPosition) => {
  safeGtag('event', 'game_started', {
    event_category: 'game',
    game_mode: gameMode, // 'private_room', 'random_match'
    player_position: playerPosition, // 'X', 'O'
  });
};

// Gameplay Events
export const trackMoveMade = (moveCount, position, player) => {
  // Convert array index to board position (0-8 -> A1-C3)
  const boardPosition = indexToBoardPosition(position);
  
  safeGtag('event', 'move_made', {
    event_category: 'gameplay',
    move_number: moveCount,
    position: boardPosition,
    player: player, // 'X', 'O'
  });
};

export const trackGameCompleted = (gameResult, gameDuration, totalMoves, winner) => {
  safeGtag('event', 'game_completed', {
    event_category: 'game',
    game_result: gameResult, // 'win', 'lose', 'draw'
    game_duration: Math.round(gameDuration / 1000), // Convert to seconds
    total_moves: totalMoves,
    winner: winner, // 'X', 'O', 'draw'
  });
};

export const trackGameAbandoned = (abandonReason, gameProgress) => {
  safeGtag('event', 'game_abandoned', {
    event_category: 'game',
    abandon_reason: abandonReason, // 'disconnect', 'quit', 'timeout'
    game_progress: gameProgress, // 'early', 'mid', 'late'
  });
};

// User Engagement Events
export const trackRematchRequested = (previousResult) => {
  safeGtag('event', 'rematch_requested', {
    event_category: 'engagement',
    previous_result: previousResult, // 'win', 'lose', 'draw'
  });
};

export const trackSessionMilestone = (gamesPlayed, sessionDuration) => {
  safeGtag('event', 'session_milestone', {
    event_category: 'engagement',
    games_played: gamesPlayed,
    session_duration: Math.round(sessionDuration / 60000), // Convert to minutes
  });
};

export const trackWaitingForOpponent = (waitTime, matchType) => {
  safeGtag('event', 'waiting_for_opponent', {
    event_category: 'matchmaking',
    wait_time_seconds: Math.round(waitTime / 1000),
    match_type: matchType, // 'random', 'room_code'
  });
};

// Technical/Performance Events
export const trackWebSocketConnected = (connectionTime) => {
  safeGtag('event', 'websocket_connected', {
    event_category: 'technical',
    connection_time_ms: connectionTime,
  });
};

export const trackWebSocketError = (errorType) => {
  safeGtag('event', 'websocket_error', {
    event_category: 'technical',
    error_type: errorType,
  });
};

// Utility functions
const indexToBoardPosition = (index) => {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const rowLabels = ['A', 'B', 'C'];
  const colLabels = ['1', '2', '3'];
  return `${rowLabels[row]}${colLabels[col]}`;
};

// Helper to determine game progress based on move count
export const getGameProgress = (moveCount) => {
  if (moveCount <= 2) return 'early';
  if (moveCount <= 5) return 'mid';
  return 'late';
};

// Session tracking utilities
let sessionStartTime = Date.now();
let gamesPlayedThisSession = 0;

export const incrementSessionGameCount = () => {
  gamesPlayedThisSession++;
  
  // Track milestone events
  if (gamesPlayedThisSession === 3 || gamesPlayedThisSession === 5 || gamesPlayedThisSession % 10 === 0) {
    const sessionDuration = Date.now() - sessionStartTime;
    trackSessionMilestone(gamesPlayedThisSession, sessionDuration);
  }
};

export const getSessionStats = () => ({
  gamesPlayed: gamesPlayedThisSession,
  sessionDuration: Date.now() - sessionStartTime,
});

// Game timing utilities
let gameStartTime = null;

export const startGameTimer = () => {
  gameStartTime = Date.now();
};

export const getGameDuration = () => {
  return gameStartTime ? Date.now() - gameStartTime : 0;
};