package com.game.controller;

import com.game.service.GameService;
import com.game.service.GameService.JoinRoomResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Controller;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.security.Principal;
import java.util.Map;
import java.util.stream.Collectors;

@Configuration
@EnableScheduling
@Controller
public class GameController {

    private static final Logger logger = LoggerFactory.getLogger(GameController.class);

    @Autowired
    private GameService gameService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private SimpUserRegistry simpUserRegistry;

    @Value("${spring.profiles.active}")
    private String activeProfile;

    @MessageMapping("/createRoom")
    public void createRoom(@Payload Map<String, Object> payload, Principal principal) {
        String requestedRoomId = (String) payload.get("roomId");
        if (requestedRoomId != null && !requestedRoomId.isEmpty()) {
            // Check if the requested room ID is already taken
            if (gameService.getRooms().contains(requestedRoomId)) {
                logger.info("Room with ID {} already exists", requestedRoomId);
                // handle it later
            }
            // Create a room with the requested ID
            gameService.createRoom(requestedRoomId);
            logger.info("Room created with ID: {}", requestedRoomId);
            messagingTemplate.convertAndSend("/topic/public",
                    Map.of("type", "room_created", "roomId", requestedRoomId));
            return;
        }
        // Create a room with a random ID
        String roomId = gameService.createRoom();
        logger.info("Room created with ID: {}", roomId);
        messagingTemplate.convertAndSend("/topic/public",
                Map.of("type", "room_created", "roomId", roomId));
    }

    /**
     * Handles requests to join a room.
     *
     * @param payload the join request payload containing roomId and username
     */
    @MessageMapping("/joinRoom")
    public void joinRoom(@Payload Map<String, Object> payload, Principal principal) {
        String desiredRoomId = (String) payload.get("roomId");
        String username = principal.getName();
        JoinRoomResponse response = gameService.joinRoom(desiredRoomId, username);
        String assignedRoomId = response.getRoomId();
        String playerSymbol = response.getPlayerSymbol();
        boolean isRoomFull = gameService.isRoomFull(assignedRoomId);

        if (assignedRoomId.equals(desiredRoomId)) {
            // Successfully joined the desired room
            logger.info("Player {} joined room with ID: {}", username, assignedRoomId);
        } else {
            // Created a new room and assigned the player to it
            logger.info("Player {} joined new room with ID: {}", username, assignedRoomId);
        }
        // Send confirmation to the joining player
        messagingTemplate.convertAndSendToUser(
                username,
                "/queue/join",
                Map.of(
                        "type", "room_joined",
                        "roomId", assignedRoomId,
                        "playerSymbol", playerSymbol,
                        "squares", gameService.getSquares(assignedRoomId),
                        "history", gameService.getHistory(assignedRoomId),
                        "xIsNext", gameService.isXIsNext(assignedRoomId),
                        "isRoomFull", isRoomFull));
        // Notify other players in the room
        messagingTemplate.convertAndSend("/topic/room/" + assignedRoomId,
                Map.of("type", "player_joined", "roomId", assignedRoomId, "isRoomFull", isRoomFull));
    }

    /**
     * Handles game state updates from clients.
     *
     * @param payload the game state payload containing roomId and gameState
     */
    @MessageMapping("/updateGameState")
    public void updateGameState(@Payload Map<String, Object> payload) {
        String roomId = (String) payload.get("roomId");
        @SuppressWarnings("unchecked")
        Map<String, Object> gameState = (Map<String, Object>) payload.get("gameState");
        gameService.updateGameState(roomId, gameState);
        logger.info("Game state updated for room: {}", roomId);
        // Broadcast the updated game state to all players in the room
        messagingTemplate.convertAndSend("/topic/room/" + roomId,
                Map.of("type", "game_state_updated", "gameState", gameState));
    }

    /*
     * Broadcast available rooms to all players, at every 2 seconds
     */
    // @Scheduled(fixedRate = 2000)
    // public void broadcastRooms() {
    //     List<String> rooms = gameService.getRooms();
    //     logger.info("Broadcasting available rooms : {}", rooms.size());
    //     messagingTemplate.convertAndSend("/topic/public",
    //             Map.of("type", "rooms", "rooms", rooms));
    // }

    /*
     * Broadcast active players to all players, at every 5 seconds
     */
    @Scheduled(fixedRate = 5000)
    public void broadcastActivePlayers() {
        int activePlayers = this.simpUserRegistry
                .getUsers()
                .stream()
                .map(SimpUser::getName)
                .collect(Collectors.toList()).size();
        if (activeProfile.equals("local"))
            logger.info("Broadcasting active players : {}", activePlayers);
        messagingTemplate.convertAndSend("/topic/public",
                Map.of("type", "active_players", "activePlayers", activePlayers));
    }
}