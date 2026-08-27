import React, { useState, useEffect, useRef, useMemo, useActionState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Board from './components/Game/Board';
import { ThemeProvider } from 'styled-components';
import { webSocketService } from './utils/websocket';
import { generateUsername } from 'unique-username-generator';
import { theme } from './styles/theme';
import { Container } from './components/UI/Container';
import { Controls, RoomControls, GameInfo, Message, TurnInfo, RoomControlsButtonGroup, OrDivider, Tagline, RuleHint, RoomCode, WaitingDots, MutedNote, ShareRow } from './components/UI/Misc';
import { Input, Button, Label, ChipButton } from './components/UI/Input';
import GlobalStyle from './styles/GlobalStyle';
import { calculateWinner } from './utils/helper';
import { buildInviteLink, shareLink, sanitizeRoomCode } from './utils/share';

// Whether this platform can hand an image file to the native share sheet
// (phones: yes, which is the only way into Instagram; desktops: download)
const canShareFiles = (() => {
  try {
    const probe = new File([''], 'probe.png', { type: 'image/png' });
    return !!(navigator.canShare && navigator.canShare({ files: [probe] }));
  } catch (err) {
    return false;
  }
})();
import { renderShareCard, shareCardImage, copyCardToClipboard } from './utils/shareCard';
import Header from './components/UI/Header';
import Footer from './components/UI/Footer';

// Code-split what the first paint never needs: the status dashboard and
// the confetti (only shown when a game ends)
const Status = lazy(() => import('./components/Status/Status'));
const Confetti = lazy(() => import('react-confetti'));
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
  // Truncation can leave a trailing separator, which reads as a typo.
  // Persisted per-tab so a page refresh keeps the same identity (the server
  // can then treat the reconnect as the same player instead of a new one).
  const [username, setUsername] = useState(() => {
    try {
      const saved = sessionStorage.getItem('ttt_username');
      if (saved) return saved;
      const fresh = generateUsername("-", 0, 16).replace(/-+$/, '');
      sessionStorage.setItem('ttt_username', fresh);
      return fresh;
    } catch (err) {
      return generateUsername("-", 0, 16).replace(/-+$/, '');
    }
  });
  const [gameWinner, setGameWinner] = useState(null);
  const [isRoomFull, setIsRoomFull] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const isCreatingRoomRef = useRef(isCreatingRoom);
  const [waitingStartTime, setWaitingStartTime] = useState(null);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [forfeitWin, setForfeitWin] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  // Generated once - regenerating on every render made the placeholder flicker
  const [placeholderCode] = useState(() => generateUsername("-", 3, 6));
  // The room subscription callback is captured once, so live values it needs
  // must come through refs
  const isRoomFullRef = useRef(isRoomFull);
  const gameWinnerRef = useRef(gameWinner);
  const roomIdRef = useRef(roomId);
  const playerSymbolRef = useRef(playerSymbol);
  const waitingStartTimeRef = useRef(waitingStartTime);
  const gameStartTimeRef = useRef(gameStartTime);
  const historyRef = useRef(history);
  const inputRoomIdRef = useRef(inputRoomId);
  // The room id we actually asked to join (as opposed to the one the server
  // assigned) - lets us tell the caller when they were diverted to a
  // different room, and lets a lost invite-link auto-join be retried
  const pendingJoinRoomIdRef = useRef(null);
  // onConnect re-fires on every reconnect, so the invite-link auto-join
  // analytics event must only fire once, on the very first connection
  const hasAutoJoinedRef = useRef(false);
  // Whether the invite-link auto-join has actually landed a room_joined;
  // while false, every reconnect retries it (the previous attempt's join
  // may have been lost with the dropped connection)
  const autoJoinCompleteRef = useRef(false);
  // The reconnecting banner is only meaningful after a connection existed
  const hasEverConnectedRef = useRef(false);
  // Stats for the shareable victory card: moves this game (history is capped
  // at 6 so it can't be derived), duration frozen at the winning move, and a
  // per-device win streak
  const xIsNextRef = useRef(true);
  const gameMovesRef = useRef(0);
  const gameDurationRef = useRef(0);
  const streakRef = useRef(0);
  // Bumped every time a server-authoritative state is applied (optimistic
  // commit or broadcast). Lets a late ack-timeout tell whether something
  // newer has already superseded the move it would otherwise roll back.
  const stateVersionRef = useRef(0);

  const updateStreak = (didWin) => {
    try {
      const next = didWin ? (parseInt(localStorage.getItem('ttt_win_streak'), 10) || 0) + 1 : 0;
      localStorage.setItem('ttt_win_streak', String(next));
      streakRef.current = next;
    } catch (err) {
      streakRef.current = didWin ? streakRef.current + 1 : 0;
    }
  };

  // Guards against recording the same game end twice (local commit + its
  // server echo both detect the winner). Returns whether this call was the
  // one that actually recorded it, so callers can gate one-shot side
  // effects (analytics) on the same check instead of racing separately.
  const gameEndRecordedRef = useRef(false);

  const recordGameEnd = (winner) => {
    if (gameEndRecordedRef.current) return false;
    gameEndRecordedRef.current = true;
    gameDurationRef.current = getGameDuration();
    updateStreak(winner === playerSymbolRef.current);
    return true;
  };

  const resetGameStats = () => {
    gameMovesRef.current = 0;
    gameEndRecordedRef.current = false;
  };
  // Tracks the pending auto-clear so a new message can't be wiped early by
  // a stale timeout from a previous message
  const messageTimer = useRef(null);
  // True while the current message has no auto-clear (ms === 0) - lets a
  // disconnect clear a "joining..." style toast that would otherwise sit
  // on screen forever once the send behind it can no longer complete
  const pendingMessageRef = useRef(false);
  // In-flight guard for the share card render/share
  const sharingCardRef = useRef(false);

  const showMessage = (text, ms = 4000) => {
    setMessage(text);
    pendingMessageRef.current = !ms;
    clearTimeout(messageTimer.current);
    if (ms) messageTimer.current = setTimeout(() => setMessage(''), ms);
  };

  useEffect(() => {
    try {
      streakRef.current = parseInt(localStorage.getItem('ttt_win_streak'), 10) || 0;
    } catch (err) {
      // localStorage unavailable (private mode): streak just starts at 0
    }
  }, []);

  useEffect(() => {
    isCreatingRoomRef.current = isCreatingRoom;
  }, [isCreatingRoom]);

  useEffect(() => {
    isRoomFullRef.current = isRoomFull;
    // Start the game clock the moment the room fills. The websocket callbacks
    // also do this, but they close over stale state; this effect is the
    // reliable path for both players.
    if (isRoomFull) {
      startGameTimer();
    }
  }, [isRoomFull]);

  useEffect(() => {
    gameWinnerRef.current = gameWinner;
  }, [gameWinner]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    playerSymbolRef.current = playerSymbol;
  }, [playerSymbol]);

  useEffect(() => {
    waitingStartTimeRef.current = waitingStartTime;
  }, [waitingStartTime]);

  useEffect(() => {
    gameStartTimeRef.current = gameStartTime;
  }, [gameStartTime]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    inputRoomIdRef.current = inputRoomId;
  }, [inputRoomId]);

  useEffect(() => {
    // Invite links carry the room code as ?room=..., join automatically once connected.
    // Sanitized because some share targets append the share text to the URL.
    const urlRoom = sanitizeRoomCode(new URLSearchParams(window.location.search).get('room'));
    if (urlRoom) {
      setInputRoomId(urlRoom);
    }
    // Single onConnect callback shared by everyone: it always reflects connection
    // state, and does the invite-link auto-join on the first connect - and
    // retries it on every subsequent reconnect until a room_joined actually
    // lands, since the connection can die before the response arrives
    webSocketService.setOnConnectCallback(() => {
      hasEverConnectedRef.current = true;
      setIsConnected(true);
      if (urlRoom && !autoJoinCompleteRef.current) {
        pendingJoinRoomIdRef.current = urlRoom;
        webSocketService.joinRoom(urlRoom);
        showMessage('joining game...', 0);
        if (!hasAutoJoinedRef.current) {
          hasAutoJoinedRef.current = true;
          trackGameStartIntent('invite_link');
        }
      }
    });
    webSocketService.setOnDisconnectCallback(() => {
      setIsConnected(false);
      // A "creating room...", "joining game..." etc toast has no auto-clear
      // because it is waiting on a server response - once the socket drops
      // that response cannot arrive, so the toast would otherwise sit there
      // forever alongside the reconnecting banner
      if (pendingMessageRef.current) {
        setMessage('');
        pendingMessageRef.current = false;
      }
    });
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
    if (data.type === 'welcome' && data.username && data.username !== username) {
      // The server renamed this tab (duplicated-tab identity): adopt the new
      // name. Changing state reconnects once under it; allow the invite-link
      // auto-join to run again on that fresh connection.
      hasAutoJoinedRef.current = false;
      try {
        sessionStorage.setItem('ttt_username', data.username);
      } catch (err) {
        // per-tab persistence unavailable; the in-memory name still updates
      }
      setUsername(data.username);
    }
    if (data.type === 'rooms') {
      setAvailableRooms(data.rooms);
    }
    // if (data.type === 'room_created') {
    //   setAvailableRooms((prevRooms) => [...prevRooms, data.roomId]);
    // }
    if (data.type === 'room_created' && isCreatingRoomRef.current) {
      setRoomId(data.roomId);
      pendingJoinRoomIdRef.current = data.roomId;
      webSocketService.joinRoom(data.roomId);
      showMessage('connecting...', 0);
      setIsCreatingRoom(false);
    }
    if (data.type === 'active_players') {
      setActivePlayers(data.activePlayers);
    }
  };

  const handleJoinRoomResponse = (data) => {
    if (data.type === 'room_joined' || data.type === 'room_assigned') {
      // The room id we actually asked for, captured by whichever action
      // initiated this join (create/join/random/invite-link auto-join). A
      // plain reconnect (websocket.js re-sending `join` with the remembered
      // roomId on its own, with no App-level action involved) leaves this
      // null - fall back to the room we were already in, since that is what
      // an automatic reconnect is always trying to return to. Random match
      // stores '' (it asks for no room in particular), which must not fall
      // through to the old room id or a normal match would look like a
      // diversion.
      const requestedRoomId = pendingJoinRoomIdRef.current === ''
        ? null
        : pendingJoinRoomIdRef.current || roomIdRef.current || null;
      pendingJoinRoomIdRef.current = null;
      // Any room_joined means the invite-link auto-join (if any) is done -
      // it no longer needs retrying on the next reconnect
      autoJoinCompleteRef.current = true;

      setRoomId(data.roomId);
      setPlayerSymbol(data.playerSymbol);
      setSquares(data.squares);
      setHistory(data.history);
      setXIsNext(data.xIsNext);
      xIsNextRef.current = data.xIsNext;

      // Reconcile the result with the authoritative board instead of
      // assuming a fresh game: a rejoin (refresh, reconnect) can land on a
      // board that is already won, and gameWinner must reflect that rather
      // than staying whatever it was before this response
      const winner = calculateWinner(data.squares);
      setGameWinner(winner || null);
      setForfeitWin(false);

      if (data.history.length === 0) {
        // Genuinely fresh board: this is the start of a new match
        resetGameStats();
        gameDurationRef.current = 0;
      } else {
        gameMovesRef.current = data.history.length;
        if (winner) {
          // Don't record streak/duration/analytics for a result we merely
          // rejoined into - just make sure it can't be mistaken for a new
          // win later
          gameEndRecordedRef.current = true;
        }
      }

      setIsRoomFull(data.isRoomFull);
      setIsCreatingRoom(false);
      if (joinResolveRef.current) {
        joinResolveRef.current();
        joinResolveRef.current = null;
      }
      // Keep the room code in the URL so the address bar itself is a shareable invite
      window.history.replaceState(null, '', `${window.location.pathname}?room=${encodeURIComponent(data.roomId)}`);

      if (requestedRoomId && data.roomId !== requestedRoomId) {
        // The server couldn't seat us in the room we asked for (full, gone,
        // or a typo) and silently diverted us into a new one - say so
        showMessage('that room was full, you are in a new one', 6000);
        setInputRoomId(data.roomId);
      } else {
        showMessage('room joined');
      }

      // Track room joined event
      const joinMethod = requestedRoomId ? 'room_code' : 'random_match';
      trackRoomJoined(joinMethod, data.roomId);

      // Start waiting timer if room is not full
      if (!data.isRoomFull) {
        setWaitingStartTime(Date.now());
        trackWaitingForOpponent(0, joinMethod);
      } else {
        // Game is starting with both players
        const gameMode = requestedRoomId ? 'private_room' : 'random_match';
        trackGameStarted(gameMode, data.playerSymbol);
        setGameStartTime(Date.now());
        startGameTimer();
      }
    }
  };

  const handleReceiveGameState = (data) => {
    if (data.type === 'game_state_updated') {
      if (data.gameState.history.length === 0) {
        // Fresh board (rematch or reset)
        resetGameStats();
        gameDurationRef.current = 0;
      } else if (data.gameState.xIsNext !== xIsNextRef.current) {
        // A turn flip we haven't applied yet is the opponent's move; our own
        // moves are counted at commit time and their echo doesn't flip again
        gameMovesRef.current += 1;
      }
      xIsNextRef.current = data.gameState.xIsNext;
      stateVersionRef.current += 1;
      setSquares(data.gameState.squares);
      setHistory(data.gameState.history);
      setXIsNext(data.gameState.xIsNext);
      const winner = calculateWinner(data.gameState.squares);
      // recordGameEnd is the single dedup gate (it flips synchronously, so
      // it can't race the way a gameWinnerRef check - updated only via a
      // later effect - could): whichever of this broadcast or the mover's
      // own ack success handler gets here first is the one that reports it
      if (winner && recordGameEnd(winner.winner)) {
        const gameResult = winner.winner === playerSymbolRef.current ? 'win' : 'lose';
        trackGameCompleted(gameResult, getGameDuration(), data.gameState.history.length, winner.winner);
        incrementSessionGameCount();
      }
      setGameWinner(winner);
    }
    if (data.type === 'player_joined' && data.roomId === roomIdRef.current) {
      setIsRoomFull(data.isRoomFull);
      setForfeitWin(false);

      if (data.isRoomFull) {
        // A new opponent is seated - this is a fresh match's stats,
        // whether the previous one ended in a win or the loser just left
        resetGameStats();
        gameDurationRef.current = 0;
      }

      // Track when second player joins and game actually starts
      if (data.isRoomFull && waitingStartTimeRef.current) {
        const waitTime = Date.now() - waitingStartTimeRef.current;
        const joinMethod = inputRoomIdRef.current.trim() ? 'room_code' : 'random_match';
        trackWaitingForOpponent(waitTime, joinMethod);

        const gameMode = inputRoomIdRef.current.trim() ? 'private_room' : 'random_match';
        trackGameStarted(gameMode, playerSymbolRef.current);
        setGameStartTime(Date.now());
        startGameTimer();
        setWaitingStartTime(null);
      }
    }
    if (data.type === 'player_disconnected' && data.roomId === roomIdRef.current) {
      const gameIsOver = !!gameWinnerRef.current;

      if (gameIsOver) {
        // The game already ended - keep the finished board, the winner
        // highlight and the rematch/share UI exactly as they are; the
        // opponent leaving now is just a note, not a state change
        if (data.username !== username) {
          showMessage('opponent left the room');
        }
        return;
      }

      const gameWasLive = isRoomFullRef.current;
      setIsRoomFull(false);
      setSquares(initialSquares);
      setHistory([]);
      setXIsNext(true);
      xIsNextRef.current = true;
      setGameWinner(null);
      if (data.username !== username) {
        // Track game abandonment due to disconnection
        if (gameStartTimeRef.current) {
          const progress = getGameProgress(historyRef.current.length);
          trackGameAbandoned('disconnect', progress);
        }

        if (gameWasLive) {
          // Opponent abandoned a live game - the remaining player wins by
          // forfeit and stays in the room to invite the next challenger.
          // Reset the per-game stats now so a later win in the same seat
          // doesn't inherit this game's streak/duration/move count.
          setForfeitWin(true);
          resetGameStats();
          gameDurationRef.current = 0;
        } else {
          showMessage('opponent left the room');
        }
      }
    }
  };

  // Resolved by handleJoinRoomResponse's room_joined branch, or by a 10s
  // timeout so a lost/never-arriving response can't strand the action pending forever
  const joinResolveRef = useRef(null);
  const awaitJoin = () => new Promise((resolve) => {
    joinResolveRef.current = resolve;
    setTimeout(resolve, 10000);
  });

  const [, createAction, createPending] = useActionState(async () => {
    // Set the ref synchronously (not just the state) - the room_created
    // handler below can otherwise fire before a state update inside this
    // action transition has committed, and isCreatingRoomRef would still read false.
    isCreatingRoomRef.current = true;
    setIsCreatingRoom(true); // Set the flag before creating room
    // A manual action supersedes any still-pending invite-link auto-join
    autoJoinCompleteRef.current = true;
    webSocketService.createRoom(username, inputRoomId.trim());
    showMessage('creating room...', 0);

    // Track game start intent and room creation
    trackGameStartIntent('create_room');
    trackRoomCreated('private', 1);
    await awaitJoin();
  }, null);

  const [, joinAction, joinPending] = useActionState(async () => {
    const requestedRoomId = inputRoomId.trim();
    pendingJoinRoomIdRef.current = requestedRoomId;
    autoJoinCompleteRef.current = true;
    webSocketService.joinRoom(requestedRoomId);
    showMessage('joining game...', 0);

    // Track game start intent
    trackGameStartIntent(requestedRoomId ? 'join_room' : 'random_match');
    await awaitJoin();
  }, null);

  const [, randomAction, randomPending] = useActionState(async () => {
    // Ignore whatever is typed in the room-code box - random match always
    // joins an empty room id
    pendingJoinRoomIdRef.current = '';
    autoJoinCompleteRef.current = true;
    webSocketService.joinRoom('');
    showMessage('finding a match...', 0);
    trackGameStartIntent('random_match');
    await awaitJoin();
  }, null);

  const anyPending = createPending || joinPending || randomPending;

  const handleSquareClick = (index) => {
    const isPlayersTurn =
      (playerSymbol === 'X' && xIsNext) ||
      (playerSymbol === 'O' && !xIsNext);

    if (!isPlayersTurn) {
      showMessage("wait your turn");
      return;
    } else {
      showMessage('', 0);
    }

    if (squares[index] || calculateWinner(squares)) {
      return;
    }

    if (!webSocketService.connected) {
      showMessage('reconnecting, try again in a moment');
      return;
    }

    const newSquares = squares.slice();
    newSquares[index] = playerSymbol;

    let newHistory = [...history, index];
    if (newHistory.length > 6) {
      const removedIndex = newHistory.shift();
      newSquares[removedIndex] = null;
    }

    // Optimistically commit the move locally, then roll back if the server
    // never acks it (e.g. the connection dropped in flight)
    const prevSquares = squares;
    const prevHistory = history;
    const prevXIsNext = xIsNext;

    setSquares(newSquares);
    setHistory(newHistory);
    setXIsNext(!xIsNext);
    gameMovesRef.current += 1;
    xIsNextRef.current = !xIsNext;
    // Snapshot the local state version right after committing - if a server
    // broadcast lands before the ack does, it will bump this further, and a
    // late ack-timeout must then leave the (now authoritative) state alone
    // instead of reverting to what we captured above
    stateVersionRef.current += 1;
    const myVersion = stateVersionRef.current;

    // Track the move
    trackMoveMade(newHistory.length, index, playerSymbol);

    webSocketService.sendMove(roomId, {
      squares: newSquares,
      history: newHistory,
      xIsNext: !xIsNext,
    }).then(() => {
      // Only record the game's end once the move is confirmed - an
      // unconfirmed "win" must never inflate the streak or fire analytics
      const winner = calculateWinner(newSquares);
      if (winner && recordGameEnd(winner.winner)) {
        const gameResult = winner.winner === playerSymbol ? 'win' : 'lose';
        trackGameCompleted(gameResult, getGameDuration(), newHistory.length, winner.winner);
        incrementSessionGameCount();
      }
    }).catch(() => {
      if (stateVersionRef.current !== myVersion) {
        // Something newer (the server's own broadcast for this move, or a
        // later move) already landed - the move was not lost, only its ack
        // was, so rolling back now would revert confirmed state
        return;
      }
      setSquares(prevSquares);
      setHistory(prevHistory);
      setXIsNext(prevXIsNext);
      gameMovesRef.current -= 1;
      xIsNextRef.current = prevXIsNext;
      showMessage("move didn't go through, try again");
    });
  };

  const handleNewGame = (e) => {
    e.preventDefault();

    if (!webSocketService.connected) {
      // Never reset the local board without the server hearing about it -
      // that would strand the player on a blank board the opponent (and
      // the server) never agreed to
      showMessage('reconnecting, try again in a moment');
      return;
    }

    const prevSquares = squares;
    const prevHistory = history;
    const prevXIsNext = xIsNext;
    const prevGameWinner = gameWinner;

    setSquares(initialSquares);
    setHistory([]);
    setXIsNext(true);
    setGameWinner(null);
    resetGameStats();
    gameDurationRef.current = 0;
    xIsNextRef.current = true;

    // Track rematch request
    if (gameWinner) {
      const previousResult = gameWinner.winner === playerSymbol ? 'win' : 'lose';
      trackRematchRequested(previousResult);
    }

    // Reset game timer
    setGameStartTime(Date.now());
    startGameTimer();

    webSocketService.sendMove(roomId, {
      squares: initialSquares,
      history: [],
      xIsNext: true,
    }).catch(() => {
      // The reset never reached the server - restore the result screen
      // instead of leaving the player on a dead blank board with no way
      // back to the rematch/share controls
      setSquares(prevSquares);
      setHistory(prevHistory);
      setXIsNext(prevXIsNext);
      setGameWinner(prevGameWinner);
      xIsNextRef.current = prevXIsNext;
      showMessage("move didn't go through, try again");
    });
  }

  const handleInviteFriend = async () => {
    // Share the bare link only - share targets that merge text and url
    // would otherwise mangle the room code out of the invite.
    const result = await shareLink(buildInviteLink(roomId));
    if (result === 'shared') showMessage('invite sent!', 6000);
    if (result === 'copied') showMessage('invite link copied, paste it anywhere', 6000);
    if (result === 'failed') showMessage(buildInviteLink(roomId), 6000);
    trackInviteShared(result, isRoomFull ? 'in_game' : 'waiting');
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      showMessage('code copied');
    } catch (err) {
      showMessage('copy failed, long-press the code instead');
    }
  };

  const didWin = gameWinner && gameWinner.winner === playerSymbol;
  const gameUrl = `${window.location.origin}${window.location.pathname}`;
  const shareText = didWin
    ? 'i just won at tic-tac-two: tic-tac-toe where your moves vanish after 6 turns. think you can beat me?'
    : 'i just played tic-tac-two: tic-tac-toe where your moves vanish after 6 turns. it gets tricky, try it:';

  // One-tap platform shares: pre-filled intents, the OG card rides along on
  // the link unfurl. Instagram has no web share URL, so the card button's
  // native sheet is the only route there.
  const handleShareIntent = async (channel) => {
    const intents = {
      x: `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(gameUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(gameUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${gameUrl}`)}`,
      threads: `https://www.threads.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(gameUrl)}`,
    };
    if (canShareFiles) {
      // Mobile first: hand the card straight to the native share sheet so
      // the app the user picks gets the image attached directly, the
      // standard mobile share flow. No intent URL, no clipboard.
      try {
        const blob = await renderShareCard({
          result: didWin ? 'win' : 'lose',
          squares,
          winningLine: gameWinner && gameWinner.line,
          stats: {
            durationMs: gameDurationRef.current,
            moves: gameMovesRef.current,
            streak: didWin ? streakRef.current : 0,
          },
        });
        const result = await shareCardImage(blob, { text: shareText, url: gameUrl, fallback: 'none' });
        if (result === 'failed') {
          // sharing failed outright, fall back to the intent URL so the tap
          // still does something
          window.open(intents[channel], '_blank', 'noopener');
        }
        // 'dismissed' needs no follow up, the user chose to back out
      } catch (err) {
        window.open(intents[channel], '_blank', 'noopener');
      }
      trackResultShared(channel, didWin ? 'win' : 'lose');
      return;
    }

    if (channel === 'x' || channel === 'threads') {
      // Open synchronously on the click's user-activation, before any await,
      // or popup blockers will swallow it.
      window.open(intents[channel], '_blank', 'noopener');
      try {
        const blob = await renderShareCard({
          result: didWin ? 'win' : 'lose',
          squares,
          winningLine: gameWinner && gameWinner.line,
          stats: {
            durationMs: gameDurationRef.current,
            moves: gameMovesRef.current,
            streak: didWin ? streakRef.current : 0,
          },
        });
        const copied = await copyCardToClipboard(blob);
        if (copied) showMessage('victory card copied, paste it into your post', 8000);
      } catch (err) {
        // card copy is a bonus; the link's OG image still unfurls either way
      }
    } else {
      window.open(intents[channel], '_blank', 'noopener');
    }
    trackResultShared(channel, didWin ? 'win' : 'lose');
  };

  const handleShareCard = async () => {
    if (sharingCardRef.current) return; // double-taps produced duplicate files
    sharingCardRef.current = true;
    try {
      const blob = await renderShareCard({
        result: didWin ? 'win' : 'lose',
        squares,
        winningLine: gameWinner && gameWinner.line,
        stats: {
          durationMs: gameDurationRef.current,
          moves: gameMovesRef.current,
          streak: didWin ? streakRef.current : 0,
        },
      });
      const result = await shareCardImage(blob, { text: shareText, url: gameUrl });
      if (result === 'shared') showMessage('shared!');
      if (result === 'downloaded') showMessage('card saved, post it anywhere', 6000);
      if (result === 'failed') showMessage('could not create the card, try again');
      trackResultShared(`card_${result}`, didWin ? 'win' : 'lose');
    } finally {
      // Cooldown rather than plain unlock: rendering is fast enough that an
      // accidental double-click would otherwise produce two files
      setTimeout(() => {
        sharingCardRef.current = false;
      }, 1500);
    }
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

  const pageTitle = useMemo(() => {
    if (!roomId) return null;
    if (gameWinner) {
      return gameWinner.winner === playerSymbol ? 'you win - tic-tac-two' : 'you lose - tic-tac-two';
    }
    if (isRoomFull) {
      return isMyTurn ? 'your move - tic-tac-two' : "opponent's turn - tic-tac-two";
    }
    return 'waiting for an opponent - tic-tac-two';
  }, [roomId, gameWinner, playerSymbol, isRoomFull, isMyTurn]);

  return (
    <>
      {pageTitle && <title>{pageTitle}</title>}
      <Header username={username} />
      <Container>
        <>
          {!roomId ? (
            <>
              <Tagline>tic-tac-toe where moves vanish</Tagline>
              <RuleHint>
                your last 3 marks stay on the board, older ones vanish.
                remember what's gone. no draws, ever.
              </RuleHint>
              <Controls>
                <form action={joinAction} style={{ display: 'contents' }}>
                  <RoomControls>
                    <Label>room code</Label>
                    <Input
                      type="text"
                      placeholder={`e.g. ${placeholderCode}`}
                      value={inputRoomId}
                      onChange={(e) => setInputRoomId(e.target.value.replace(/\s+/g, ''))}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <RoomControlsButtonGroup>
                      <Button formAction={createAction} disabled={!inputRoomId || anyPending || !isConnected}>
                        {createPending ? 'creating...' : 'new game'}
                      </Button>
                      <Button type="submit" $ghost disabled={!inputRoomId || anyPending || !isConnected}>
                        {joinPending ? 'joining...' : 'join game'}
                      </Button>
                    </RoomControlsButtonGroup>
                  </RoomControls>
                </form>
                <OrDivider>or</OrDivider>
                <form action={randomAction} style={{ display: 'contents' }}>
                  <Button type="submit" disabled={anyPending || !isConnected}>
                    {randomPending ? 'matching...' : 'random match'}
                  </Button>
                </form>
              </Controls>
            </>
          ) : (
            <>
              {!isRoomFull ? (
                <>
                  {forfeitWin && (
                    <TurnInfo $mine $big>you win, opponent left 🏆</TurnInfo>
                  )}
                  <GameInfo>
                    <WaitingDots>waiting for an opponent</WaitingDots>
                  </GameInfo>
                  <Button onClick={handleInviteFriend}>invite a friend</Button>
                  <RuleHint>
                    send the link, the game starts the moment they open it
                  </RuleHint>
                  <MutedNote>or tell them the room code</MutedNote>
                  <RoomCode onClick={handleCopyCode} title="click to copy">{roomId}</RoomCode>
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
                    disabled={disabled || !!gameWinner || !isConnected}
                    winners={gameWinner && gameWinner.line}
                  />
                  <TurnInfo $mine={gameWinner ? gameWinner.winner === playerSymbol : isMyTurn} $big={!!gameWinner}>
                    {turnMessage}
                  </TurnInfo>
                </>
              )}
              {gameWinner && (
                <>
                  <RoomControlsButtonGroup>
                    <Button onClick={handleNewGame}>new match</Button>
                    <Button onClick={handleShareCard}>
                      {canShareFiles ? 'share card' : 'save card'}
                    </Button>
                  </RoomControlsButtonGroup>
                  <MutedNote>{didWin ? 'brag about it on' : 'find a challenger on'}</MutedNote>
                  <ShareRow>
                    <ChipButton onClick={() => handleShareIntent('x')}>share on x</ChipButton>
                    <ChipButton onClick={() => handleShareIntent('threads')}>threads</ChipButton>
                    <ChipButton onClick={() => handleShareIntent('facebook')}>facebook</ChipButton>
                    <ChipButton onClick={() => handleShareIntent('whatsapp')}>whatsapp</ChipButton>
                  </ShareRow>
                </>
              )}
            </>
          )}
          {!isConnected && hasEverConnectedRef.current && <Message>reconnecting…</Message>}
          {message && <Message>{message}</Message>}
          <Suspense fallback={null}>
            {gameWinner && gameWinner.winner === playerSymbol && <Confetti recycle={false} numberOfPieces={500} />}
            {forfeitWin && <Confetti recycle={false} numberOfPieces={350} />}
          </Suspense>
          <MutedNote>
            {activePlayers} player{activePlayers === 1 ? '' : 's'} online
          </MutedNote>
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
          <Route path="/status" element={<Suspense fallback={null}><Status /></Suspense>} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
