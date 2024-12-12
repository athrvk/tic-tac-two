package com.game.config;

import com.game.service.GameService;

import java.security.Principal;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
public class WebSocketEventListener {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketEventListener.class);

    @Autowired
    private GameService gameService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void handleWebSocketDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String username = Optional.ofNullable(headerAccessor.getUser())
                .map(Principal::getName)
                .orElse(null);
        String roomId = gameService.getRoomOfPlayer(username);

        if (roomId != null && username != null) {
            if (gameService.removePlayerFromRoom(roomId, username)) {
                logger.info("Player {} disconnected from room {}", username, roomId);
                messagingTemplate.convertAndSend("/topic/room/" + roomId,
                        Map.of("type", "player_disconnected", "username", username, "roomId", roomId));
            }
        }
    }
}
