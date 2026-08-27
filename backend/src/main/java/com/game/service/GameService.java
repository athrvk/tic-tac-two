package com.game.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.game.model.GameState;

import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GameService {

    private static final Logger logger = LoggerFactory.getLogger(GameService.class);

    // Short, speakable codes: no ambiguous characters (0/o, 1/l/i)
    private static final String CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
    private static final int CODE_LENGTH = 6;
    private static final SecureRandom CODE_RANDOM = new SecureRandom();

    // Stores roomId to game state mapping
    private final Map<String, GameState> rooms = new ConcurrentHashMap<>();
    // Stores username to roomId mapping
    private final Map<String, String> playerRoomMap = new ConcurrentHashMap<>();

    /**
     * Creates a new game room with a short generated code (instead of a UUID,
     * so random-match rooms are as speakable and typeable as user-chosen ones).
     *
     * @return the generated room ID
     */
    public String createRoom() {
        String roomId;
        do {
            StringBuilder code = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                code.append(CODE_CHARS.charAt(CODE_RANDOM.nextInt(CODE_CHARS.length())));
            }
            roomId = code.toString();
        } while (rooms.putIfAbsent(roomId, new GameState()) != null);
        logger.info("Created new room with ID: {}", roomId);
        return roomId;
    }

    /**
     * Creates a new game room with the specified ID.
     *
     * @param roomId the desired room ID
     * @return the room ID
     */
    public String createRoom(String roomId) {
        GameState existing = rooms.get(roomId);
        if (existing != null && existing.getPlayers() > 0) {
            // Never reset a room that has players in it - the creator will
            // simply join it (e.g. two friends both pressing "new game" with
            // the same code end up in the same room)
            logger.info("Room {} already exists with players, joining instead of resetting", roomId);
            return roomId;
        }
        rooms.put(roomId, new GameState());
        logger.info("Created new room on user request with ID: {}", roomId);
        return roomId;
    }

    /**
     * Allows a user to join a game room. If the desired room ID is not provided or is empty,
     * the method will attempt to find a room with only one player and join it. If no such room
     * is found, a new room will be created and the user will join it. If a desired room ID is
     * provided, the method will attempt to join that room if it has less than two players. If
     * the room is full or does not exist, a new room will be created and the user will join it.
     *
     * @param desiredRoomId the ID of the room the user wants to join, or null/empty to join any available room
     * @param username the username of the player joining the room
     * @return a JoinRoomResponse containing the room ID and the symbol assigned to the player
     */
    public JoinRoomResponse joinRoom(String desiredRoomId, String username) {
        if (desiredRoomId == null || desiredRoomId.isEmpty()) {
            logger.info("Joining any available room for user: {}", username);
            // Try to find a room with only one player
            for (Map.Entry<String, GameState> entry : rooms.entrySet()) {
                GameState room = entry.getValue();
                if (room.getPlayers() == 1) {
                    String symbol = room.assignSymbol(username);
                    if (symbol == null) {
                        // Room filled up concurrently, keep looking
                        continue;
                    }
                    playerRoomMap.put(username, entry.getKey());
                    logger.info("Players in room {}: {}", entry.getKey(), room.getPlayerSymbols());
                    return new JoinRoomResponse(entry.getKey(), symbol);
                }
            }
            // If no room with one player is found, create a new room
            return joinNewRoom(username);
        }
        GameState desiredRoom = rooms.get(desiredRoomId);
        if (desiredRoom != null) {
            String symbol = desiredRoom.assignSymbol(username);
            if (symbol != null) {
                logger.info("Joining existing room on user request with ID: {}", desiredRoomId);
                playerRoomMap.put(username, desiredRoomId);
                logger.info("Players in room {}: {}", desiredRoomId, desiredRoom.getPlayerSymbols());
                return new JoinRoomResponse(desiredRoomId, symbol);
            }
        }
        // Desired room is full or does not exist - create a new room
        return joinNewRoom(username);
    }

    private JoinRoomResponse joinNewRoom(String username) {
        String newRoomId = createRoom();
        GameState newRoom = rooms.get(newRoomId);
        String symbol = newRoom.assignSymbol(username);
        playerRoomMap.put(username, newRoomId);
        logger.info("Players in room {}: {}", newRoomId, newRoom.getPlayerSymbols());
        return new JoinRoomResponse(newRoomId, symbol);
    }

    /**
     * Updates the game state for a specific room after validating the
     * client-supplied payload (9 squares of null/X/O, at most 6 history
     * entries with board indices, and a boolean turn flag).
     *
     * @param roomId    the ID of the room
     * @param gameState the new game state
     * @return true if the state was valid and applied, false otherwise
     */
    public boolean updateGameState(String roomId, Map<String, Object> gameState) {
        GameState state = rooms.get(roomId);
        if (state == null) {
            logger.warn("Attempted to update non-existent room: {}", roomId);
            return false;
        }
        Object squaresObj = gameState.get("squares");
        Object historyObj = gameState.get("history");
        Object xIsNextObj = gameState.get("xIsNext");
        if (!(squaresObj instanceof List) || !(historyObj instanceof List) || !(xIsNextObj instanceof Boolean)) {
            logger.warn("Rejected malformed game state for room: {}", roomId);
            return false;
        }
        List<?> rawSquares = (List<?>) squaresObj;
        List<?> rawHistory = (List<?>) historyObj;
        if (rawSquares.size() != 9 || rawHistory.size() > 6) {
            logger.warn("Rejected out-of-shape game state for room: {}", roomId);
            return false;
        }
        List<String> squares = new ArrayList<>(9);
        for (Object sq : rawSquares) {
            if (sq != null && !"X".equals(sq) && !"O".equals(sq)) {
                logger.warn("Rejected invalid square value for room: {}", roomId);
                return false;
            }
            squares.add((String) sq);
        }
        List<Integer> history = new ArrayList<>(rawHistory.size());
        for (Object move : rawHistory) {
            if (!(move instanceof Integer) || (Integer) move < 0 || (Integer) move > 8) {
                logger.warn("Rejected invalid history entry for room: {}", roomId);
                return false;
            }
            history.add((Integer) move);
        }
        state.setSquares(squares);
        state.setHistory(history);
        state.setXIsNext((Boolean) xIsNextObj);
        logger.info("Updated game state for room: {}", roomId);
        return true;
    }

    /**
     * Determines if a room is full (i.e. has 2 players).
     *
     * @param roomId the ID of the room
     * @return true if the room is full, false otherwise
     */
    public boolean isRoomFull(String roomId) {
        GameState state = rooms.get(roomId);
        return state != null && state.getPlayers() == 2;
    }

    /**
     * Retrieves the room ID of a player.
     *
     * @param username the username of the player
     * @return the room ID, or null if not found
     */
    public String getRoomOfPlayer(String username) {
        if (username == null) {
            return null;
        }
        return playerRoomMap.get(username);
    }

    /**
     * Removes the disconnected player from the room and deletes the room if it becomes empty.
     *
     * @param roomId the ID of the room
     * @param username the username of the player to remove
     * @return true if the player was successfully removed, false otherwise
     */
    public boolean removePlayerFromRoom(String roomId, String username) {
        GameState gameState = rooms.get(roomId);
        if (gameState != null) {
            if (gameState.removePlayer(username)) {
                playerRoomMap.remove(username);
                logger.info("Removed player {} from room {}", username, roomId);
                
                // Check if room is now empty and remove it if so
                if (gameState.getPlayers() == 0) {
                    rooms.remove(roomId);
                    logger.info("Room {} removed as it has no more players", roomId);
                }
                
                return true;
            }
        }
        return false;
    }

    /**
     * Retrieves the list of rooms with 0 or just 1 player.
     *
     * @return list of room IDs
     */
    public List<String> getRooms() {
        List<String> availableRooms = new ArrayList<>();
        for (Map.Entry<String, GameState> entry : rooms.entrySet()) {
            GameState room = entry.getValue();
            if (room.getPlayers() < 2) {
                availableRooms.add(entry.getKey());
            }
        }
        return availableRooms;
    }

    /**
     * Retrieves the squares state for a room.
     *
     * @param roomId the ID of the room
     * @return list of squares
     */
    public List<String> getSquares(String roomId) {
        GameState state = rooms.get(roomId);
        return state != null ? state.getSquares() : Collections.emptyList();
    }

    /**
     * Retrieves the history of moves for a room.
     *
     * @param roomId the ID of the room
     * @return list of move indices
     */
    public List<Integer> getHistory(String roomId) {
        GameState state = rooms.get(roomId);
        return state != null ? state.getHistory() : Collections.emptyList();
    }

    /**
     * Determines whose turn it is next for a room.
     *
     * @param roomId the ID of the room
     * @return true if X's turn, false if O's turn
     */
    public boolean isXIsNext(String roomId) {
        GameState state = rooms.get(roomId);
        return state != null && state.isXIsNext();
    }

    /**
     * Retrieves the symbol assigned to a player.
     *
     * @param roomId   the ID of the room
     * @param username the username of the player
     * @return the assigned symbol ('X' or 'O'), or null if not found
     */
    public String getPlayerSymbol(String roomId, String username) {
        GameState state = rooms.get(roomId);
        return state != null ? state.getPlayerSymbol(username) : null;
    }

    /**
     * Retrieves all rooms and their current players.
     *
     * @return map of room IDs to room information
     */
    public Map<String, Map<String, Object>> getAllRoomsWithPlayers() {
        Map<String, Map<String, Object>> roomsInfo = new HashMap<>();
        
        for (Map.Entry<String, GameState> entry : rooms.entrySet()) {
            String roomId = entry.getKey();
            GameState gameState = entry.getValue();
            
            Map<String, Object> roomInfo = new HashMap<>();
            roomInfo.put("players", gameState.getPlayerSymbols());
            roomInfo.put("playerCount", gameState.getPlayers());
            roomInfo.put("isGameActive", gameState.getPlayers() == 2);
            roomInfo.put("currentTurn", gameState.isXIsNext() ? "X" : "O");
            
            roomsInfo.put(roomId, roomInfo);
        }
        
        return roomsInfo;
    }

    /**
     * Response class for joinRoom method.
     */
    public static class JoinRoomResponse {
        private String roomId;
        private String playerSymbol;

        public JoinRoomResponse(String roomId, String playerSymbol) {
            this.roomId = roomId;
            this.playerSymbol = playerSymbol;
        }

        public String getRoomId() {
            return roomId;
        }

        public String getPlayerSymbol() {
            return playerSymbol;
        }
    }
}