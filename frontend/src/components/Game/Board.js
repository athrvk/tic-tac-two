import React from 'react';
import styled from 'styled-components';
import Square from './Square';

const BoardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  width: 100%;
  max-width: 400px;
  margin: 1rem auto;

  @media (max-width: 768px) {
    max-width: 300px;
    gap: 0.25rem;
  }
`;

const Board = ({ squares, onSquareClick, disabled, winners }) => (
  <BoardGrid>
    {squares.map((value, index) => (
      <Square
        key={index}
        value={value}
        disabled={disabled}
        isWinning={winners && winners.includes(index)}
        onClick={() => onSquareClick(index)}
      />
    ))}
  </BoardGrid>
);

export default Board;