package com.game.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.game.model.GameState;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GameService {

    private static final Logger logger = LoggerFactory.getLogger(GameService.class);

    // Stores roomId to game state mapping
    private final Map<String, GameState> rooms = new ConcurrentHashMap<>();
    // Stores username to roomId mapping
    private final Map<String, String> playerRoomMap = new ConcurrentHashMap<>();

    /**
     * Creates a new game room with a unique ID.
     *
     * @return the generated room ID
     */
    public String createRoom() {
        String roomId = UUID.randomUUID().toString();
        rooms.put(roomId, new GameState());
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
        if (rooms.containsKey(roomId)) {
            logger.warn("Room ID {} already exists, resetting it's state", roomId);
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
                    playerRoomMap.put(username, entry.getKey());
                    Map<String, String> playerSymbols = room.getPlayerSymbols();
                    logger.info("Players in room {}: {}", entry.getKey(), playerSymbols);
                    return new JoinRoomResponse(entry.getKey(), symbol);
                }
            }
            // If no room with one player is found, create a new room
            String newRoomId = createRoom();
            GameState newRoom = rooms.get(newRoomId);
            String symbol = newRoom.assignSymbol(username);
            playerRoomMap.put(username, newRoomId);
            Map<String, String> playerSymbols = newRoom.getPlayerSymbols();
            logger.info("Players in room {}: {}", newRoomId, playerSymbols);
            return new JoinRoomResponse(newRoomId, symbol);
        }
        GameState desiredRoom = rooms.get(desiredRoomId);
        if (desiredRoom != null && desiredRoom.getPlayers() < 2) {
            logger.info("Joining existing room on user request with ID: {}", desiredRoomId);
            String symbol = desiredRoom.assignSymbol(username);
            playerRoomMap.put(username, desiredRoomId);
            Map<String, String> playerSymbols = desiredRoom.getPlayerSymbols();
            logger.info("Players in room {}: {}", desiredRoomId, playerSymbols);
            return new JoinRoomResponse(desiredRoomId, symbol);
        }
        // If no room with one player is found, create a new room
        String newRoomId = createRoom();
        GameState newRoom = rooms.get(newRoomId);
        String symbol = newRoom.assignSymbol(username);
        playerRoomMap.put(username, newRoomId);
        Map<String, String> playerSymbols = newRoom.getPlayerSymbols();
        logger.info("Players in room {}: {}", newRoomId, playerSymbols);
        return new JoinRoomResponse(newRoomId, symbol);
    }

    /**
     * Updates the game state for a specific room.
     *
     * @param roomId    the ID of the room
     * @param gameState the new game state
     */
    @SuppressWarnings("unchecked")
    public void updateGameState(String roomId, Map<String, Object> gameState) {
        GameState state = rooms.get(roomId);
        if (state != null) {
            state.setSquares((List<String>) gameState.get("squares"));
            state.setHistory((List<Integer>) gameState.get("history"));
            state.setXIsNext((Boolean) gameState.get("xIsNext"));
            logger.info("Updated game state for room: {}", roomId);
        } else {
            logger.error("Attempted to update non-existent room: {}", roomId);
        }
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
     * Removes the disconnected player from the room.
     *
     * @param roomId the ID of the room to remove
     */
    public boolean removePlayerFromRoom(String roomId, String username) {
        GameState gameState = rooms.get(roomId);
        if (gameState != null) {
            if (gameState.removePlayer(username)) {
                playerRoomMap.remove(username);
                logger.info("Removed player {} from room {}", username, roomId);
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