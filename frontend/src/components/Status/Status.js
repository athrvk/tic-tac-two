import React, { useState, useEffect } from 'react';
import { statusWebSocketService } from '../../utils/statusWebsocket';
import { Container } from '../UI/Container';
import Header from '../UI/Header';
import Footer from '../UI/Footer';
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
    // Generate a unique identifier for this status session
    const [sessionId] = useState(`status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    useEffect(() => {
        console.log('Status component: Setting up dedicated WebSocket connection...');

        // Connect to the status WebSocket service
        statusWebSocketService.connect();
        setIsConnected(statusWebSocketService.isConnected());

        // Set up connection callbacks
        statusWebSocketService.setOnConnectCallback(() => {
            setIsConnected(true);
            console.log('Status: WebSocket connected, subscribing to status updates');

            // Subscribe to status updates after connection is established
            statusWebSocketService.subscribe('/topic/status', (data) => {
                if (data.type === 'game_state_update') {
                    console.log('Status: Received game state update:', data.rooms);
                    setGameState(data.rooms || {});
                }
            });
        });

        statusWebSocketService.setOnDisconnectCallback(() => {
            setIsConnected(false);
            console.log('Status: WebSocket disconnected');
        });

        // If already connected, subscribe immediately
        if (statusWebSocketService.isConnected()) {
            statusWebSocketService.subscribe('/topic/status', (data) => {
                if (data.type === 'game_state_update') {
                    console.log('Status: Received game state update:', data.rooms);
                    setGameState(data.rooms || {});
                }
            });
        }

        return () => {
            console.log('Status component: Cleaning up dedicated WebSocket connection...');
            // Unsubscribe from status updates
            statusWebSocketService.unsubscribe('/topic/status');
            // Disconnect the status WebSocket when component unmounts
            statusWebSocketService.disconnect();
        };
    }, [sessionId]); const rooms = Object.entries(gameState);
    const totalRooms = rooms.length;
    const activeGames = rooms.filter(([_, room]) => room.isGameActive).length;
    const waitingRooms = rooms.filter(([_, room]) => !room.isGameActive).length;
    const totalPlayers = rooms.reduce((sum, [_, room]) => sum + room.playerCount, 0);

    return (
        <>
            <Header username={sessionId} showBackLink={true} />
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