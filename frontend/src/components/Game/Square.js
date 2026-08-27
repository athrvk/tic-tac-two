import React from 'react';
import styled, { keyframes, css } from 'styled-components';

const popIn = keyframes`
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
`;

const StyledSquare = styled.button`
  width: 100%;
  position: relative;
  padding-top: 100%; /* Creates a square box */
  border: 1px solid ${(props) => (props.$isWinning ? props.theme.colors.primary : props.theme.colors.border)};
  border-radius: 12px;
  background: ${(props) => (props.$isWinning ? props.theme.colors.primary : props.theme.colors.surface)};
  font-size: 2.4rem;
  font-weight: bold;
  cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
  box-shadow: 0 1px 2px rgba(20, 20, 20, 0.06);
  transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    background: ${(props) => (props.$isWinning ? props.theme.colors.primary : props.theme.colors.hover)};
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(20, 20, 20, 0.1);
  }

  .square-content {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: inherit;
    font-style: ${(props) => (props.value === 'X' ? 'italic' : 'normal')};
    color: ${(props) => {
      if (props.$isWinning) return props.theme.colors.background;
      if (props.value === 'X') return props.theme.colors.xInk;
      if (props.value === 'O') return props.theme.colors.oInk;
      return props.theme.colors.text;
    }};
    ${(props) => props.value && css`animation: ${popIn} 0.18s ease-out;`}
  }

  @media (max-width: 768px) {
    font-size: 2rem;
    border-radius: 10px;
  }
`;

const Square = ({ value, onClick, disabled, isWinning }) => (
  <StyledSquare
    onClick={onClick}
    value={value}
    disabled={disabled}
    $isWinning={isWinning}
  >
    <div className="square-content">
    {value}
    </div>
  </StyledSquare>
);

export default Square;
