import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Board from './components/Game/Board';
import Status from './components/Status/Status';
import { ThemeProvider } from 'styled-components';
import { webSocketService } from './utils/websocket';
import { generateUsername } from 'unique-username-generator';
import { theme } from './styles/theme';
import { Container } from './components/UI/Container';
import { Controls, RoomControls, GameInfo, Message, TurnInfo, RoomControlsButtonGroup, OrDivider, Tagline, RuleHint, RoomCode, WaitingDots } from './components/UI/Misc';
import { Input, Button, Label } from './components/UI/Input';
import GlobalStyle from './styles/GlobalStyle';
import { calculateWinner } from './utils/helper';
import { buildInviteLink, shareLink, shareOrCopy, sanitizeRoomCode } from './utils/share';
import Header from './components/UI/Header';
import Footer from './components/UI/Footer';
import Confetti from 'react-confetti';
import {
  trackGameStartIntent,
  trackRoomCreated,
  trackRoomJoined,
  trackGameStarted,
  trackMoveMade,
  trackGameCompleted,
  trackGameAbandoned,
  trackRematchRequested,
  trackWaitingForOpponent,
  startGameTimer,
  getGameDuration,
  incrementSessionGameCount,
  getGameProgress,
  trackInviteShared,
  trackResultShared
} from './utils/analytics';


function GamePage() {
  const initialSquares = Array(9).fill(null);
  const [squares, setSquares] = useState(initialSquares);
  const [history, setHistory] = useState([]);
  const [xIsNext, setXIsNext] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [roomId, setRoomId] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [availableRooms, setAvailableRooms] = useState([]);
  const [activePlayers, setActivePlayers] = useState(0);
  const [inputRoomId, setInputRoomId] = useState('');
  const [message, setMessage] = useState('');
  const [playerSymbol, setPlayerSymbol] = useState('');
  const [username] = useState(generateUsername("-", 0, 16));
  const [gameWinner, setGameWinner] = useState(null);
  const [isRoomFull, setIsRoomFull] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const isCreatingRoomRef = useRef(isCreatingRoom);
  const [waitingStartTime, setWaitingStartTime] = useState(null);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [forfeitWin, setForfeitWin] = useState(false);
  // The room subscription callback is captured once, so live values it needs
  // must come through refs
  const isRoomFullRef = useRef(isRoomFull);
  const gameWinnerRef = useRef(gameWinner);

  useEffect(() => {
    isCreatingRoomRef.current = isCreatingRoom;
  }, [isCreatingRoom]);

  useEffect(() => {
    isRoomFullRef.current = isRoomFull;
  }, [isRoomFull]);

  useEffect(() => {
    gameWinnerRef.current = gameWinner;
  }, [gameWinner]);

  useEffect(() => {
    // Invite links carry the room code as ?room=..., join automatically once connected.
    // Sanitized because some share targets append the share text to the URL.
    const urlRoom = sanitizeRoomCode(new URLSearchParams(window.location.search).get('room'));
    if (urlRoom) {
      setInputRoomId(urlRoom);
      webSocketService.setOnConnectCallback(() => {
        webSocketService.joinRoom(urlRoom);
        setMessage('joining game...');
        trackGameStartIntent('invite_link');
      });
    }
    webSocketService.connect(username);
    webSocketService.setOnMessageCallback(handleReceiveMessage);
    webSocketService.setOnJoinRoomCallback(handleJoinRoomResponse); // Set join room callback

    return () => {
      webSocketService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  useEffect(() => {
    if (webSocketService.connected && roomId) {
      webSocketService.subscribe(roomId, handleReceiveGameState);
      console.log('Subscribed to room:', roomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webSocketService.connected, roomId]);

  useEffect(() => {
    const isPlayersTurn =
      (playerSymbol === 'X' && xIsNext) ||
      (playerSymbol === 'O' && !xIsNext);
    setDisabled(!isPlayersTurn);
  }, [playerSymbol, xIsNext]);

  const handleReceiveMessage = (data) => {
    if (data.type === 'rooms') {
      setAvailableRooms(data.rooms);
    }
    // if (data.type === 'room_created') {
    //   setAvailableRooms((prevRooms) => [...prevRooms, data.roomId]);
    // }
    if (data.type === 'room_created' && isCreatingRoomRef.current) {
      setRoomId(data.roomId);
      webSocketService.joinRoom(data.roomId);
      setMessage('connecting to ' + data.roomId);
      setIsCreatingRoom(false);
    }
    if (data.type === 'active_players') {
      setActivePlayers(data.activePlayers);
    }
  };

  const handleJoinRoomResponse = (data) => {
    if (data.type === 'room_joined' || data.type === 'room_assigned') {
      setRoomId(data.roomId);
      setPlayerSymbol(data.playerSymbol);
      setSquares(data.squares);
      setHistory(data.history);
      setXIsNext(data.xIsNext);
      setIsRoomFull(data.isRoomFull);
      setMessage(`joined room: ${data.roomId}`);
      setTimeout(() => setMessage(''), 4000);
      setIsCreatingRoom(false);
      // Keep the room code in the URL so the address bar itself is a shareable invite
      window.history.replaceState(null, '', `${window.location.pathname}?room=${encodeURIComponent(data.roomId)}`);

      // Track room joined event
      const joinMethod = inputRoomId.trim() ? 'room_code' : 'random_match';
      trackRoomJoined(joinMethod, data.roomId);

      // Start waiting timer if room is not full
      if (!data.isRoomFull) {
        setWaitingStartTime(Date.now());
        trackWaitingForOpponent(0, joinMethod);
      } else {
        // Game is starting with both players
        const gameMode = inputRoomId.trim() ? 'private_room' : 'random_match';
        trackGameStarted(gameMode, data.playerSymbol);
        setGameStartTime(Date.now());
        startGameTimer();
      }
    }
  };

  const handleReceiveGameState = (data) => {
    if (data.type === 'game_state_updated') {
      setSquares(data.gameState.squares);
      setHistory(data.gameState.history);
      setXIsNext(data.gameState.xIsNext);
      setGameWinner(calculateWinner(data.gameState.squares));
    }
    if (data.type === 'player_joined' && data.roomId === roomId) {
      setIsRoomFull(data.isRoomFull);
      setForfeitWin(false);

      // Track when second player joins and game actually starts
      if (data.isRoomFull && waitingStartTime) {
        const waitTime = Date.now() - waitingStartTime;
        const joinMethod = inputRoomId.trim() ? 'room_code' : 'random_match';
        trackWaitingForOpponent(waitTime, joinMethod);

        const gameMode = inputRoomId.trim() ? 'private_room' : 'random_match';
        trackGameStarted(gameMode, playerSymbol);
        setGameStartTime(Date.now());
        startGameTimer();
        setWaitingStartTime(null);
      }
    }
    if (data.type === 'player_disconnected' && data.roomId === roomId) {
      const gameWasLive = isRoomFullRef.current && !gameWinnerRef.current;
      setIsRoomFull(false);
      setSquares(initialSquares);
      setHistory([]);
      setXIsNext(true);
      setGameWinner(null);
      if (data.username !== username) {
        // Track game abandonment due to disconnection
        if (gameStartTime) {
          const progress = getGameProgress(history.length);
          trackGameAbandoned('disconnect', progress);
        }

        if (gameWasLive) {
          // Opponent abandoned a live game — the remaining player wins by
          // forfeit and stays in the room to invite the next challenger
          setForfeitWin(true);
        } else {
          setMessage('opponent left the room');
          setTimeout(() => setMessage(''), 4000);
        }
      }
    }
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    setIsCreatingRoom(true); // Set the flag before creating room
    webSocketService.createRoom(username, inputRoomId.trim());
    setMessage('creating room...');

    // Track game start intent and room creation
    trackGameStartIntent('create_room');
    trackRoomCreated('private', 1);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    // if (inputRoomId.trim() !== '') {
    webSocketService.joinRoom(inputRoomId.trim());
    setMessage('joining game...');

    // Track game start intent
    const method = inputRoomId.trim() ? 'join_room' : 'random_match';
    trackGameStartIntent(method);
    // }
  };

  const handleSquareClick = (index) => {
    const isPlayersTurn =
      (playerSymbol === 'X' && xIsNext) ||
      (playerSymbol === 'O' && !xIsNext);

    if (!isPlayersTurn) {
      setMessage("wait your turn");
      setTimeout(() => setMessage(''), 4000);
      return;
    } else {
      setMessage('');
    }

    if (squares[index] || calculateWinner(squares)) {
      return;
    }

    const newSquares = squares.slice();
    newSquares[index] = playerSymbol;

    let newHistory = [...history, index];
    if (newHistory.length > 6) {
      const removedIndex = newHistory.shift();
      newSquares[removedIndex] = null;
    }

    setSquares(newSquares);
    setHistory(newHistory);
    setXIsNext(!xIsNext);

    // Track the move
    trackMoveMade(newHistory.length, index, playerSymbol);

    // Check for game completion
    const winner = calculateWinner(newSquares);
    if (winner) {
      const gameDuration = getGameDuration();
      const gameResult = winner.winner === playerSymbol ? 'win' : 'lose';
      trackGameCompleted(gameResult, gameDuration, newHistory.length, winner.winner);
      incrementSessionGameCount();
    }

    webSocketService.sendGameState(roomId, {
      squares: newSquares,
      history: newHistory,
      xIsNext: !xIsNext,
    });
  };

  const handleNewGame = (e) => {
    e.preventDefault();
    setSquares(initialSquares);
    setHistory([]);
    setXIsNext(true);
    setGameWinner(null);

    // Track rematch request
    if (gameWinner) {
      const previousResult = gameWinner.winner === playerSymbol ? 'win' : 'lose';
      trackRematchRequested(previousResult);
    }

    // Reset game timer
    setGameStartTime(Date.now());
    startGameTimer();

    webSocketService.sendGameState(roomId, {
      squares: initialSquares,
      history: [],
      xIsNext: true,
    });
  }

  const handleInviteFriend = async () => {
    // Share the bare link only — share targets that merge text and url
    // would otherwise mangle the room code out of the invite.
    const result = await shareLink(buildInviteLink(roomId));
    if (result === 'shared') setMessage('invite sent!');
    if (result === 'copied') setMessage('invite link copied — paste it anywhere');
    if (result === 'failed') setMessage(buildInviteLink(roomId));
    setTimeout(() => setMessage(''), 6000);
    trackInviteShared(result, isRoomFull ? 'in_game' : 'waiting');
  };

  const handleShareResult = async () => {
    const didWin = gameWinner && gameWinner.winner === playerSymbol;
    const text = didWin
      ? 'i just won at tic-tac-two — tic-tac-toe where your moves vanish after 6 turns. think you can beat me?'
      : 'i just played tic-tac-two — tic-tac-toe where your moves vanish after 6 turns. it gets tricky, try it:';
    const result = await shareOrCopy({
      title: 'tic-tac-two',
      text,
      url: `${window.location.origin}${window.location.pathname}`,
    });
    if (result === 'shared') setMessage('shared!');
    if (result === 'copied') setMessage('copied, paste it anywhere!');
    setTimeout(() => setMessage(''), 4000);
    trackResultShared(result, didWin ? 'win' : 'lose');
  };

  const turnMessage = useMemo(() => {
    if (gameWinner) {
      return gameWinner.winner === playerSymbol ? 'you win' : 'you lose';
    }
    if (xIsNext && playerSymbol === 'X') {
      return "your move";
    }
    if (!xIsNext && playerSymbol === 'O') {
      return "your move";
    }
    return "opponent's turn";
  }, [gameWinner, playerSymbol, xIsNext]);

  const isMyTurn = (playerSymbol === 'X' && xIsNext) || (playerSymbol === 'O' && !xIsNext);



  return (
    <>
      <Header username={username} />
      <Container>
        <>
          {!roomId ? (
            <>
              <Tagline>tic-tac-toe where moves vanish</Tagline>
              <RuleHint>
                only your last 3 marks stay on the board — the oldest one
                vanishes as you play. remember what's gone. no draws, ever.
              </RuleHint>
              <Controls>
                <RoomControls>
                  <Label>room code</Label>
                  <Input
                    type="text"
                    placeholder={generateUsername("-", 3, 6)}
                    value={inputRoomId}
                    onChange={(e) => setInputRoomId(e.target.value)}
                  />
                  <RoomControlsButtonGroup>
                    <Button onClick={handleCreateRoom} disabled={!inputRoomId}>new game</Button>
                    <Button $ghost onClick={handleJoinRoom} disabled={!inputRoomId}>join game</Button>
                  </RoomControlsButtonGroup>
                </RoomControls>
                <OrDivider>or</OrDivider>
                <Button onClick={handleJoinRoom}>random match</Button>
              </Controls>
            </>
          ) : (
            <>
              {!isRoomFull ? (
                <>
                  {forfeitWin && (
                    <TurnInfo $mine>you win — opponent left 🏆</TurnInfo>
                  )}
                  <GameInfo>
                    <WaitingDots>awaiting player</WaitingDots>
                  </GameInfo>
                  <RoomCode>{roomId}</RoomCode>
                  <Button onClick={handleInviteFriend}>invite a friend</Button>
                  <RuleHint>
                    send the link — the game starts the moment they open it
                  </RuleHint>
                </>
              ) : (
                <>
                  <GameInfo>
                    you are{' '}
                    <span style={{
                      fontWeight: '700',
                      fontStyle: playerSymbol === 'X' ? 'italic' : 'normal',
                      color: playerSymbol === 'X' ? '#b3372a' : '#1f5f8b',
                    }}>{playerSymbol}</span>
                  </GameInfo>
                  <Board
                    squares={squares}
                    onSquareClick={handleSquareClick}
                    disabled={disabled || !!gameWinner}
                    winners={gameWinner && gameWinner.line}
                  />
                  <TurnInfo $mine={gameWinner ? gameWinner.winner === playerSymbol : isMyTurn}>
                    {turnMessage}
                  </TurnInfo>
                </>
              )}
              {gameWinner && (
                <RoomControlsButtonGroup>
                  <Button onClick={handleNewGame}>new match</Button>
                  <Button onClick={handleShareResult}>
                    {gameWinner.winner === playerSymbol ? 'brag about it' : 'share game'}
                  </Button>
                </RoomControlsButtonGroup>
              )}
            </>
          )}
          {message && <Message>{message}</Message>}
          {gameWinner && gameWinner.winner === playerSymbol && <Confetti />}
          {forfeitWin && <Confetti recycle={false} numberOfPieces={350} />}
          <GameInfo>
            players online: {activePlayers}
          </GameInfo>
        </>
      </Container>
      <Footer />
    </>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Router>
        <Routes>
          <Route path="/" element={<GamePage />} />
          <Route path="/status" element={<Status />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
