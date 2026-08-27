import styled, { css } from "styled-components";
import { theme } from '../../styles/theme';

export const Input = styled.input`
    width: 100%;
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    margin: ${theme.spacing.xs} 0;
    font-size: ${theme.typography.body.fontSize};
    font-family: ${theme.typography.fontFamily};
    border: 1px solid ${theme.colors.border};
    border-radius: 10px;
    color: ${theme.colors.text};
    background-color: ${theme.colors.surface};
    text-align: center;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:hover {
        border-color: ${theme.colors.mediumGray};
    }

    &:focus {
        outline: none;
        border-color: ${theme.colors.primary};
        box-shadow: 0 0 0 3px rgba(20, 20, 20, 0.08);
    }

    ::placeholder {
      text-align: center;
      color: ${theme.colors.mediumGray};
    }
`;

export const Label = styled.label`
  display: block;
  margin-bottom: ${theme.spacing.xs};
  font-size: 0.85rem;
  font-family: ${theme.typography.fontFamily};
  color: ${theme.colors.muted};
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

export const Button = styled.button`
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  font-size: ${({ theme }) => theme.typography.body.fontSize};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.background};
  background: ${({ theme }) => theme.colors.primary};
  border: 1.5px solid ${({ theme }) => theme.colors.primary};
  border-radius: 999px;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(20, 20, 20, 0.18);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: none;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  ${(props) => props.$ghost && css`
    color: ${props.theme.colors.text};
    background: transparent;

    &:hover:not(:disabled) {
      background: ${props.theme.colors.hover};
      box-shadow: none;
    }
  `}
`;
