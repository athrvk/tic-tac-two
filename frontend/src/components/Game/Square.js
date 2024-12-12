import React from 'react';
import styled from 'styled-components';

const StyledSquare = styled.button`
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  border: ${(props) => props.isWinning ? "4px" : "2px"} solid ${({ theme }) => theme.colors.border};
  background: none;
  font-size: 2rem;
  font-weight: bold;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: transform 0.2s ease, background-color 0.2s ease;
  color: ${props => props.value === 'X' ? 
    props.theme.colors.primary : 
    props.theme.colors.secondary
  };
  transform: ${props => props.isWinning ? 'scale(1.05)' : 'scale(1)'};

  &:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.colors.hover};
    transform: scale(1.02);
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
    {value}
  </StyledSquare>
);

export default Square;