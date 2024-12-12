package com.game.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class GameState {
    private List<String> squares;
    private List<Integer> history;
    private boolean xIsNext;
    private int players;
    private Map<String, String> playerSymbols; // Maps username to symbol

    public GameState() {
        this.squares = new ArrayList<>(Collections.nCopies(9, null));
        this.history = new ArrayList<>();
        this.xIsNext = true; // X always starts
        this.players = 0;
        this.playerSymbols = new HashMap<>();
    }

    public List<String> getSquares() {
        return squares;
    }

    public void setSquares(List<String> squares) {
        this.squares = squares;
    }

    public List<Integer> getHistory() {
        return history;
    }

    public void setHistory(List<Integer> history) {
        this.history = history;
    }

    public boolean isXIsNext() {
        return xIsNext;
    }

    public void setXIsNext(boolean xIsNext) {
        this.xIsNext = xIsNext;
    }

    public int getPlayers() {
        return players;
    }

    /**
     * Assigns a symbol to the joining player.
     *
     * @param username the username of the player
     * @return the assigned symbol ('X' or 'O')
     */
    public String assignSymbol(String username) {
        String symbol;
        if (players == 0) {
            symbol = "X";
        } else if (players == 1) {
            symbol = "O";
        } else {
            symbol = "X"; // Fallback, should not occur
        }
        playerSymbols.put(username, symbol);
        players++;
        return symbol;
    }

    /**
     * Retrieves the symbol assigned to a player.
     *
     * @param username the username of the player
     * @return the assigned symbol ('X' or 'O'), or null if not found
     */
    public String getPlayerSymbol(String username) {
        return playerSymbols.get(username);
    }

    public Map<String, String> getPlayerSymbols() {
        return playerSymbols;
    }
}
