import React, { useState, useEffect, useRef } from 'react';
import Board from './components/Game/Board';
import { ThemeProvider } from 'styled-components';
import { webSocketService } from './utils/websocket';
import { generateUsername } from 'unique-username-generator';
import { theme } from './styles/theme';
import { Container } from './components/UI/Container';
import { Controls, RoomControls, GameInfo, Message, TurnInfo, RoomControlsButtonGroup } from './components/UI/Misc';
import { Input, Button, Label } from './components/UI/Input';
import GlobalStyle from './styles/GlobalStyle';
import { calculateWinner } from './utils/helper';
import Header from './components/UI/Header';
import Footer from './components/UI/Footer';
import Confetti from 'react-confetti';


function App() {
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

  useEffect(() => {
    isCreatingRoomRef.current = isCreatingRoom;
  }, [isCreatingRoom]);

  useEffect(() => {
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
      setMessage('joining room: ' + data.roomId);
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
    }
    if (data.type === 'player_disconnected' && data.roomId === roomId) {
      setIsRoomFull(false);
      setSquares(initialSquares);
      setHistory([]);
      setXIsNext(true);
      setGameWinner(null);
      if (data.username !== username) {
        setMessage('other player disconnected');
      }
    }
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    setIsCreatingRoom(true); // Set the flag before creating room
    webSocketService.createRoom(username, inputRoomId);
    setMessage('creating room...');
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    // if (inputRoomId.trim() !== '') {
    webSocketService.joinRoom(inputRoomId.trim());
    setMessage('joining room...');
    // }
  };

  const handleSquareClick = (index) => {
    const isPlayersTurn =
      (playerSymbol === 'X' && xIsNext) ||
      (playerSymbol === 'O' && !xIsNext);

    if (!isPlayersTurn) {
      setMessage("it's not your turn!");
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
    webSocketService.sendGameState(roomId, {
      squares: initialSquares,
      history: [],
      xIsNext: true,
    });
  }

  const turnMessage = useMemo(() => {
    if (gameWinner) {
      return gameWinner.winner === playerSymbol ? 'you won!' : 'you lost!';
    }
    if (xIsNext && playerSymbol === 'X') {
      return "it's your turn!";
    }
    if (!xIsNext && playerSymbol === 'O') {
      return "it's your turn!";
    }
    return 'wait for other player to play!';
  }, [gameWinner, playerSymbol, xIsNext]);



  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Header username={username} />
      <Container>
        <>
          {!roomId ? (
            <Controls>
              <RoomControls>
                <Label>room id</Label>
                <Input
                  type="text"
                  placeholder={generateUsername("-", 3, 6)}
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value)}
                />
                <RoomControlsButtonGroup>
                  <Button onClick={handleCreateRoom} disabled={!inputRoomId}>create room</Button>
                  <Button onClick={handleCreateRoom} disabled={!inputRoomId}>join room</Button>
                </RoomControlsButtonGroup>
              </RoomControls>
              <Button onClick={handleJoinRoom}>play online</Button>
            </Controls>
          ) : (
              <>
                {!isRoomFull ? (
                  <GameInfo>
                    waiting for other player to join...
                  </GameInfo>
                ) : (
                  <>
                      <GameInfo>
                        you are: <span style={{ fontWeight: '700', color: '#777' }}>{playerSymbol}</span> in room:
                        <br />
                        <span>{roomId}</span>
                      </GameInfo>
                      <Board
                        squares={squares}
                        onSquareClick={handleSquareClick}
                        disabled={disabled || !!gameWinner}
                        winners={gameWinner && gameWinner.line}
                        winningLine={null}
                      />
                      <TurnInfo>
                        {turnMessage}
                      </TurnInfo>
                  </>
                )}
              {gameWinner && (
                <Button onClick={handleNewGame}>new game</Button>
              )}
            </>
          )}
          {message && <Message>{message}</Message>}
          {gameWinner && gameWinner.winner === playerSymbol && <Confetti />}
          <GameInfo>
            global active players: {activePlayers}
          </GameInfo>
        </>
      </Container>
      <Footer />
    </ThemeProvider>
  );
}

export default App;
