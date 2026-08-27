package com.game.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.game.service.GameService;
import com.game.service.GameService.JoinRoomResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
@EnableScheduling
public class GameWebSocketHandler extends TextWebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(GameWebSocketHandler.class);

    // A stalled client shouldn't be able to block a broadcast thread forever,
    // and a runaway peer shouldn't be able to exhaust memory buffering sends
    private static final int SEND_TIME_LIMIT_MS = 5000;
    private static final int BUFFER_SIZE_LIMIT_BYTES = 512 * 1024;
    // Client pings every 3s; anything silent for more than ~3 misses is dead
    private static final long LIVENESS_TIMEOUT_MS = 10_000;
    // A closed connection keeps its room seat briefly: a page refresh or a
    // quick network blip reconnects as the same username and resumes the game
    // instead of handing the opponent a forfeit
    private static final long DISCONNECT_GRACE_MS = 4_000;
    private static final String SUFFIX_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
    private static final java.security.SecureRandom SUFFIX_RANDOM = new java.security.SecureRandom();

    @Autowired
    private GameService gameService;

    @Value("${spring.profiles.active}")
    private String activeProfile;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, WebSocketSession> playersByUsername = new ConcurrentHashMap<>();
    private final Set<WebSocketSession> statusSessions = ConcurrentHashMap.newKeySet();
    private final Map<String, Long> lastSeen = new ConcurrentHashMap<>();
    // Session id -> username, so afterConnectionClosed can clean up without
    // relying on session attributes surviving an abrupt close
    private final Map<String, String> usernameBySessionId = new ConcurrentHashMap<>();
    // Session id -> per-page-load tab id, so a rename-adopting reconnect from
    // the same tab can be told apart from a genuine duplicate tab
    private final Map<String, String> tabBySessionId = new ConcurrentHashMap<>();
    // Username -> earliest eviction time; entries are cancelled by a reconnect
    private final Map<String, Long> pendingEvictions = new ConcurrentHashMap<>();
    // Per-room ordering for join notifications: without it, two simultaneous
    // joins can interleave so a player receives isRoomFull=true before a
    // stale isRoomFull=false and stays on the waiting screen
    private final Map<String, Object> roomLocks = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession rawSession) throws Exception {
        Map<String, String> query = parseQuery(rawSession.getUri());
        String rawUsername = query.get("username");
        if (rawUsername == null || rawUsername.isEmpty()) {
            logger.warn("WebSocket connection without a username, closing");
            rawSession.close(CloseStatus.BAD_DATA);
            return;
        }
        String username = URLDecoder.decode(rawUsername, StandardCharsets.UTF_8);
        boolean isStatus = "status".equals(query.get("type"));
        String rawTab = query.get("tab");
        String tabId = (rawTab == null || rawTab.isEmpty()) ? "" : URLDecoder.decode(rawTab, StandardCharsets.UTF_8);

        WebSocketSession session = new ConcurrentWebSocketSessionDecorator(
                rawSession, SEND_TIME_LIMIT_MS, BUFFER_SIZE_LIMIT_BYTES);

        if (!isStatus) {
            // A duplicated browser tab carries the same sessionStorage
            // identity; letting it in as-is would share one seat between two
            // live tabs. Give the newcomer its own identity instead (a
            // refresh's old session is already closed, so it keeps its name).
            WebSocketSession existing = playersByUsername.get(username);
            if (existing != null && existing.isOpen() && !existing.getId().equals(session.getId())) {
                String existingTabId = tabBySessionId.get(existing.getId());
                if (!tabId.isEmpty() && tabId.equals(existingTabId)) {
                    // Same tab reconnecting (e.g. right after adopting a
                    // rename): the old socket just hasn't been torn down yet.
                    // Keep the name and drop the stale session instead of
                    // renaming again - closeQuietly below runs before the new
                    // session is registered, so afterConnectionClosed's
                    // "still tracked under this id" check still sees the
                    // stale session as owner and doesn't touch our new one.
                    logger.info("Username {} reconnecting from same tab {}, dropping stale session", username, tabId);
                    closeQuietly(existing);
                } else {
                    // Cap growth so repeated duplication can't produce an
                    // unbounded name
                    String base = username.length() > 20 ? username.substring(0, 20) : username;
                    String candidate;
                    do {
                        candidate = base + "-" + randomSuffix();
                    } while (playersByUsername.containsKey(candidate));
                    logger.info("Username {} already live in another tab, assigning {}", username, candidate);
                    username = candidate;
                }
            }
        }

        lastSeen.put(session.getId(), System.currentTimeMillis());
        usernameBySessionId.put(session.getId(), username);
        tabBySessionId.put(session.getId(), tabId);
        if (isStatus) {
            statusSessions.add(session);
        } else {
            playersByUsername.put(username, session);
            // A reconnect within the grace window keeps the player's seat
            pendingEvictions.remove(username);
            // Tell the client its effective identity so it can adopt a rename
            sendTo(session, Map.of("type", "welcome", "username", username));
        }
    }

    private static String randomSuffix() {
        StringBuilder suffix = new StringBuilder(3);
        for (int i = 0; i < 3; i++) {
            suffix.append(SUFFIX_CHARS.charAt(SUFFIX_RANDOM.nextInt(SUFFIX_CHARS.length())));
        }
        return suffix.toString();
    }

    @Override
    protected void handleTextMessage(WebSocketSession rawSession, TextMessage message) throws Exception {
        // The container always hands handlers the original session; look up
        // our thread-safe decorator (stored at connect time) by shared id for sends
        WebSocketSession session = findSessionById(rawSession.getId());
        if (session == null) {
            session = rawSession;
        }
        lastSeen.put(rawSession.getId(), System.currentTimeMillis());
        String username = usernameBySessionId.get(rawSession.getId());

        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(message.getPayload(), Map.class);
        } catch (Exception e) {
            logger.warn("Ignoring malformed message from {}: {}", username, e.getMessage());
            return;
        }
        String type = (String) payload.get("type");
        if (type == null) {
            logger.warn("Ignoring message with no type from {}", username);
            return;
        }

        switch (type) {
            case "create" -> handleCreate(session, username, payload);
            case "join" -> handleJoin(session, username, payload);
            case "move" -> handleMove(session, username, payload);
            case "ping" -> {
                sendTo(session, Map.of("type", "pong"));
            }
            default -> logger.warn("Ignoring message of unknown type '{}' from {}", type, username);
        }
    }

    private void handleCreate(WebSocketSession session, String username, Map<String, Object> payload) {
        String requestedRoomId = normalizeRoomId((String) payload.get("roomId"));
        String roomId = (requestedRoomId != null && !requestedRoomId.isEmpty())
                ? gameService.createRoom(requestedRoomId)
                : gameService.createRoom();
        logger.info("Room created with ID: {}", roomId);
        // Reply only to the requester: a broadcast would let two users
        // creating rooms at the same time join each other's room
        sendTo(session, Map.of("type", "room_created", "roomId", roomId));
    }

    private void handleJoin(WebSocketSession session, String username, Map<String, Object> payload) {
        String desiredRoomId = normalizeRoomId((String) payload.get("roomId"));
        JoinRoomResponse response = gameService.joinRoom(desiredRoomId, username);
        String assignedRoomId = response.roomId();
        String playerSymbol = response.playerSymbol();

        if (assignedRoomId.equals(desiredRoomId)) {
            logger.info("Player {} joined room with ID: {} as requested", username, assignedRoomId);
        } else {
            logger.info("Player {} joined new room with ID: {}", username, assignedRoomId);
        }

        // Read the seat state and send inside the room lock so concurrent
        // joins can't deliver a stale isRoomFull after a fresh one
        Object roomLock = roomLocks.computeIfAbsent(assignedRoomId, k -> new Object());
        synchronized (roomLock) {
            boolean isRoomFull = gameService.isRoomFull(assignedRoomId);
            sendTo(session, Map.of(
                    "type", "room_joined",
                    "roomId", assignedRoomId,
                    "playerSymbol", playerSymbol,
                    "squares", gameService.getSquares(assignedRoomId),
                    "history", gameService.getHistory(assignedRoomId),
                    "xIsNext", gameService.isXIsNext(assignedRoomId),
                    "isRoomFull", isRoomFull));
            broadcastToRoom(assignedRoomId, Map.of(
                    "type", "player_joined", "roomId", assignedRoomId, "isRoomFull", isRoomFull));
        }
    }

    private static String normalizeRoomId(String roomId) {
        return roomId == null ? null : roomId.toLowerCase();
    }

    private void handleMove(WebSocketSession session, String username, Map<String, Object> payload) {
        String roomId = (String) payload.get("roomId");
        String moveId = (String) payload.get("moveId");
        Object gameStateObj = payload.get("gameState");
        if (!(gameStateObj instanceof Map)) {
            logger.warn("Ignoring malformed move payload for room: {}", roomId);
            return;
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> gameState = (Map<String, Object>) gameStateObj;
        if (!gameService.updateGameState(roomId, gameState)) {
            return;
        }
        logger.info("Game state updated for room: {}", roomId);
        broadcastToRoom(roomId, Map.of("type", "game_state", "roomId", roomId, "gameState", gameState));
        sendTo(session, Map.of("type", "ack", "moveId", moveId));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession rawSession, CloseStatus status) {
        String sessionId = rawSession.getId();
        String username = usernameBySessionId.remove(sessionId);
        tabBySessionId.remove(sessionId);
        lastSeen.remove(sessionId);
        statusSessions.removeIf(s -> s.getId().equals(sessionId));

        if (username == null) {
            return;
        }
        WebSocketSession tracked = playersByUsername.get(username);
        if (tracked != null && tracked.getId().equals(sessionId)) {
            playersByUsername.remove(username);
        }

        if (username.startsWith("status_monitor_")) {
            logger.info("Status monitor disconnected: {}", username);
            return;
        }

        if (gameService.getRoomOfPlayer(username) != null) {
            // Don't evict immediately: give a refresh/blip time to reconnect
            pendingEvictions.put(username, System.currentTimeMillis() + DISCONNECT_GRACE_MS);
        }
    }

    /*
     * Evict players whose disconnect grace expired without a reconnect
     */
    @Scheduled(fixedRate = 2000)
    public void processPendingEvictions() {
        long now = System.currentTimeMillis();
        pendingEvictions.forEach((username, evictAt) -> {
            if (now < evictAt) {
                return;
            }
            pendingEvictions.remove(username);
            if (playersByUsername.containsKey(username)) {
                return; // reconnected in time
            }
            String roomId = gameService.getRoomOfPlayer(username);
            if (roomId != null && gameService.removePlayerFromRoom(roomId, username)) {
                logger.info("Player {} evicted after disconnect grace from room {}", username, roomId);
                broadcastToRoom(roomId, Map.of("type", "player_disconnected", "roomId", roomId, "username", username));
                if (!gameService.getRooms().contains(roomId)) {
                    roomLocks.remove(roomId);
                }
            }
        });
    }

    /*
     * Broadcast active players to all player sessions, every 2 seconds
     */
    @Scheduled(fixedRate = 2000)
    public void broadcastActivePlayers() {
        int activePlayers = playersByUsername.size();
        if ("local".equals(activeProfile)) {
            logger.info("Broadcasting active players : {}", activePlayers);
        }
        Map<String, Object> message = Map.of("type", "active_players", "activePlayers", activePlayers);
        for (WebSocketSession session : playersByUsername.values()) {
            sendTo(session, message);
        }
    }

    /*
     * Broadcast game state information to all status page subscribers, every 2 seconds
     */
    @Scheduled(fixedRate = 2000)
    public void broadcastGameState() {
        Map<String, Map<String, Object>> gameStateInfo = gameService.getAllRoomsWithPlayers();
        if ("local".equals(activeProfile)) {
            logger.info("Broadcasting game state info for {} rooms", gameStateInfo.size());
        }
        Map<String, Object> message = Map.of("type", "status_update", "rooms", gameStateInfo);
        for (WebSocketSession session : statusSessions) {
            sendTo(session, message);
        }
    }

    /*
     * Close sessions that have gone silent for too long, every 3 seconds
     */
    @Scheduled(fixedRate = 3000)
    public void sweepDeadSessions() {
        long now = System.currentTimeMillis();
        lastSeen.forEach((sessionId, seenAt) -> {
            if (now - seenAt > LIVENESS_TIMEOUT_MS) {
                WebSocketSession session = findSessionById(sessionId);
                if (session != null) {
                    logger.warn("Closing session {} for exceeding liveness timeout", sessionId);
                    closeQuietly(session);
                }
            }
        });
    }

    private WebSocketSession findSessionById(String sessionId) {
        for (WebSocketSession session : playersByUsername.values()) {
            if (session.getId().equals(sessionId)) {
                return session;
            }
        }
        for (WebSocketSession session : statusSessions) {
            if (session.getId().equals(sessionId)) {
                return session;
            }
        }
        return null;
    }

    private void broadcastToRoom(String roomId, Map<String, Object> message) {
        // Send to every player currently mapped to this room
        for (Map.Entry<String, WebSocketSession> entry : playersByUsername.entrySet()) {
            if (roomId.equals(gameService.getRoomOfPlayer(entry.getKey()))) {
                sendTo(entry.getValue(), message);
            }
        }
    }

    private void sendTo(WebSocketSession session, Map<String, Object> message) {
        if (session == null || !session.isOpen()) {
            return;
        }
        try {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
        } catch (IOException | IllegalStateException e) {
            logger.warn("Failed to send message to session {}, closing: {}", session.getId(), e.getMessage());
            closeQuietly(session);
        }
    }

    private void closeQuietly(WebSocketSession session) {
        try {
            session.close(CloseStatus.NORMAL);
        } catch (IOException e) {
            logger.warn("Failed to close session {}: {}", session.getId(), e.getMessage());
        }
    }

    private static Map<String, String> parseQuery(URI uri) {
        Map<String, String> params = new ConcurrentHashMap<>();
        if (uri == null || uri.getQuery() == null) {
            return params;
        }
        for (String pair : uri.getQuery().split("&")) {
            int idx = pair.indexOf('=');
            if (idx < 0) {
                continue;
            }
            String key = pair.substring(0, idx);
            String value = pair.substring(idx + 1);
            params.put(key, value);
        }
        return params;
    }
}
