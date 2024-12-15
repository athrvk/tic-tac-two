import React from 'react';
import styled from 'styled-components';

const StyledSquare = styled.button`
  width: 100%;
  position: relative;
  padding-top: 100%; /* Creates a square box */
  border: ${(props) => (props.isWinning ? '4px' : '2px')} solid ${(props) => props.value ? props.theme.colors.mediumGray : props.theme.colors.lightGray}};
  background: none;
  font-size: 2rem;
  font-weight: bold;
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  color: ${({ theme }) => theme.colors.text};

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
  }

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const Square = ({ value, onClick, disabled, isWinning }) => (
  <StyledSquare 
    onClick={onClick} 
    value={value}
    disabled={disabled}
    isWinning={isWinning}
    style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
  >
    <div className="square-content">
    {value}
    </div>
  </StyledSquare>
);

export default Square;