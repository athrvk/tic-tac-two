package com.game.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.locks.ReentrantLock;

public class GameState {
    private final List<String> squares;
    private final List<Integer> history;
    private boolean xIsNext;
    private int players;
    private final Map<String, String> playerSymbols; // Maps username to symbol
    private final ReentrantLock lock;
    private final long createdAt;
    // Timestamp the room last had 0 players (starts equal to createdAt, since
    // that's the room's first empty moment); used by the GC sweep to tell a
    // freshly-emptied room apart from one that has simply never been joined
    private long emptySince;

    public GameState() {
        this.squares = new ArrayList<>(Collections.nCopies(9, null));
        this.history = new ArrayList<>();
        this.xIsNext = true; // X always starts
        this.players = 0;
        this.playerSymbols = new HashMap<>();
        this.lock = new ReentrantLock();
        this.createdAt = System.currentTimeMillis();
        this.emptySince = this.createdAt;
    }

    /**
     * @return the time (epoch millis) this room was created
     */
    public long getCreatedAt() {
        return createdAt;
    }

    /**
     * @return the time (epoch millis) this room last had 0 players
     */
    public long getEmptySince() {
        lock.lock();
        try {
            return emptySince;
        } finally {
            lock.unlock();
        }
    }

    public List<String> getSquares() {
        lock.lock();
        try {
            return new ArrayList<>(squares);
        } finally {
            lock.unlock();
        }
    }

    public void setSquares(List<String> squares) {
        lock.lock();
        try {
            this.squares.clear();
            this.squares.addAll(squares);
        } finally {
            lock.unlock();
        }
    }

    public List<Integer> getHistory() {
        lock.lock();
        try {
            return new ArrayList<>(history);
        } finally {
            lock.unlock();
        }
    }

    public void setHistory(List<Integer> history) {
        lock.lock();
        try {
            this.history.clear();
            this.history.addAll(history);
        } finally {
            lock.unlock();
        }
    }

    public boolean isXIsNext() {
        lock.lock();
        try {
            return xIsNext;
        } finally {
            lock.unlock();
        }
    }

    public void setXIsNext(boolean xIsNext) {
        lock.lock();
        try {
            this.xIsNext = xIsNext;
        } finally {
            lock.unlock();
        }
    }

    public int getPlayers() {
        lock.lock();
        try {
            return players;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Assigns a symbol to the joining player.
     *
     * @param username the username of the player
     * @return the assigned symbol ('X' or 'O')
     */
    public String assignSymbol(String username) {
        lock.lock();
        try {
            // Check if the player already has a symbol assigned
            if (playerSymbols.containsKey(username)) {
                return playerSymbols.get(username);
            }

            // Room is full - the check-then-act in callers can race, so the
            // capacity check must live inside the lock
            if (players >= 2) {
                return null;
            }

            // Assign a symbol based on existing assignments
            String symbol = !playerSymbols.containsValue("X") ? "X" : "O";

            playerSymbols.put(username, symbol);
            players++;
            return symbol;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Retrieves the symbol assigned to a player.
     *
     * @param username the username of the player
     * @return the assigned symbol ('X' or 'O'), or null if not found
     */
    public String getPlayerSymbol(String username) {
        lock.lock();
        try {
            return playerSymbols.get(username);
        } finally {
            lock.unlock();
        }
    }

    public Map<String, String> getPlayerSymbols() {
        lock.lock();
        try {
            return new HashMap<>(playerSymbols);
        } finally {
            lock.unlock();
        }
    }

    public boolean removePlayer(String username) {
        lock.lock();
        try {
            if (Objects.nonNull(playerSymbols.remove(username))) {
                // Reset the game state when a player is removed
                boolean resetResult = reset();
                players--;
                if (players == 0) {
                    emptySince = System.currentTimeMillis();
                }
                return resetResult;
            }
            return false;
        } finally {
            lock.unlock();
        }
    }

    public boolean reset() {
        lock.lock();
        try {
            Collections.fill(squares, null);
            history.clear();
            xIsNext = true;
            return true;
        } finally {
            lock.unlock();
        }
    }
}
