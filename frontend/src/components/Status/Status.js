import React, { useState, useEffect } from 'react';
import { webSocketService } from '../../utils/websocket';
import { Container } from '../UI/Container';
import Header from '../UI/Header';
import Footer from '../UI/Footer';
import { generateUsername } from 'unique-username-generator';
import {
    StatusContainer,
    PageTitle,
    StatsGrid,
    StatCard,
    StatValue,
    StatLabel,
    RoomsGrid,
    RoomCard,
    RoomHeader,
    RoomId,
    RoomStatus,
    PlayersSection,
    SectionTitle,
    PlayersList,
    Player,
    PlayerName,
    PlayerSymbol,
    GameInfo,
    TurnIndicator,
    EmptyState,
    ConnectionStatus
} from '../UI/StatusComponents';

function Status() {
    const [gameState, setGameState] = useState({});
    const [isConnected, setIsConnected] = useState(false);
    const [username] = useState(generateUsername("-", 0, 16));

    useEffect(() => {
        let statusSubscription = null;

        console.log('Status component: Setting up WebSocket connection...');
        console.log('Current WebSocket status:', {
            connected: webSocketService.isConnected(),
            currentUser: webSocketService.getCurrentUsername(),
            activeSubscriptions: webSocketService.getActiveSubscriptions()
        });

        // Function to handle connection and subscription
        const setupConnection = () => {
            if (webSocketService.connected) {
                setIsConnected(true);
                // Subscribe to status updates if not already connected to a game
                statusSubscription = webSocketService.subscribe('/topic/status', (data) => {
                    if (data.type === 'game_state_update') {
                        console.log('Status: Received game state update:', data.rooms);
                        setGameState(data.rooms || {});
                    }
                });
            } else {
                setIsConnected(false);
                // Only connect if no existing connection
                if (!webSocketService.client || !webSocketService.connected) {
                    console.log('Status: Connecting to WebSocket...');
                    webSocketService.connect(username);
                }
            }
        };

        // Set up connection status callbacks
        const originalOnConnect = webSocketService.onConnectCallback;
        const originalOnDisconnect = webSocketService.onDisconnectCallback;

        webSocketService.setOnConnectCallback(() => {
            if (originalOnConnect) originalOnConnect();
            setIsConnected(true);
            // Subscribe after connection is established
            statusSubscription = webSocketService.subscribe('/topic/status', (data) => {
                if (data.type === 'game_state_update') {
                    setGameState(data.rooms || {});
                }
            });
        });

        webSocketService.setOnDisconnectCallback(() => {
            if (originalOnDisconnect) originalOnDisconnect();
            setIsConnected(false);
        });

        // Initial setup
        setupConnection();

        return () => {
            console.log('Status component: Cleaning up...');
            // Cleanup subscription
            if (statusSubscription && typeof statusSubscription.unsubscribe === 'function') {
                statusSubscription.unsubscribe();
                console.log('Status: Unsubscribed from local subscription');
            }
            // Only unsubscribe from status topic, don't clean up other subscriptions
            webSocketService.unsubscribe('/topic/status');

            // Restore original callbacks
            webSocketService.setOnConnectCallback(originalOnConnect);
            webSocketService.setOnDisconnectCallback(originalOnDisconnect);
            console.log('Status: Restored original callbacks');
        };
    }, [username]);

    const rooms = Object.entries(gameState);
    const totalRooms = rooms.length;
    const activeGames = rooms.filter(([_, room]) => room.isGameActive).length;
    const waitingRooms = rooms.filter(([_, room]) => !room.isGameActive).length;
    const totalPlayers = rooms.reduce((sum, [_, room]) => sum + room.playerCount, 0);

    return (
        <>
            <Header username={username} showBackLink={true} />
            <Container>
                <StatusContainer>
                    <ConnectionStatus connected={isConnected}>
                        {isConnected ? '● Connected' : '● Disconnected'}
                    </ConnectionStatus>

                    <PageTitle>Game Status Dashboard</PageTitle>

                    <StatsGrid>
                        <StatCard>
                            <StatValue>{totalRooms}</StatValue>
                            <StatLabel>Total Rooms</StatLabel>
                        </StatCard>
                        <StatCard>
                            <StatValue>{activeGames}</StatValue>
                            <StatLabel>Active Games</StatLabel>
                        </StatCard>
                        <StatCard>
                            <StatValue>{waitingRooms}</StatValue>
                            <StatLabel>Waiting for Players</StatLabel>
                        </StatCard>
                        <StatCard>
                            <StatValue>{totalPlayers}</StatValue>
                            <StatLabel>Total Players</StatLabel>
                        </StatCard>
                    </StatsGrid>

                    {rooms.length === 0 ? (
                        <EmptyState>
                            No active rooms at the moment. Start a new game to see it here!
                        </EmptyState>
                    ) : (
                        <RoomsGrid>
                            {rooms.map(([roomId, room]) => (
                                <RoomCard key={roomId}>
                                    <RoomHeader>
                                        <RoomId>{roomId}</RoomId>
                                        <RoomStatus active={room.isGameActive}>
                                            {room.isGameActive ? 'Active' : 'Waiting'}
                                        </RoomStatus>
                                    </RoomHeader>

                                    <PlayersSection>
                                        <SectionTitle>Players ({room.playerCount}/2)</SectionTitle>
                                        {Object.keys(room.players).length === 0 ? (
                                            <EmptyState style={{ padding: '0.5rem' }}>
                                                No players in room
                                            </EmptyState>
                                        ) : (
                                            <PlayersList>
                                                {Object.entries(room.players).map(([playerName, symbol]) => (
                                                    <Player key={playerName}>
                                                        <PlayerName>{playerName}</PlayerName>
                                                        <PlayerSymbol>{symbol}</PlayerSymbol>
                                                    </Player>
                                                ))}
                                            </PlayersList>
                                        )}
                                    </PlayersSection>

                                    {room.isGameActive && (
                                        <GameInfo>
                                            <span>Current Turn:</span>
                                            <TurnIndicator>{room.currentTurn}</TurnIndicator>
                                        </GameInfo>
                                    )}
                                </RoomCard>
                            ))}
                        </RoomsGrid>
                    )}
                </StatusContainer>
            </Container>
            <Footer />
        </>
    );
}

export default Status;