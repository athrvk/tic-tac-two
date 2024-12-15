import styled from "styled-components";
import { theme } from '../../styles/theme';

export const Input = styled.input`
    width: 100%;
    padding: ${theme.spacing.sm};
    margin: ${theme.spacing.xs} 0;
    font-size: ${theme.typography.body.fontSize};
    font-family: ${theme.typography.fontFamily};
    border: 1px solid ${theme.colors.border};
    border-radius: 8px;
    color: ${theme.colors.text};
    background-color: ${theme.colors.background};
    text-align: center;

    &:hover {
        background-color: ${theme.colors.hover};
    }
    
    ::placeholder {
      text-align: center;
    }    
`;

export const Label = styled.label`
  display: block;
  margin-bottom: ${theme.spacing.xs};
  font-size: ${theme.typography.body.fontSize};
  font-family: ${theme.typography.fontFamily};
  color: ${theme.colors.darkText};
`;

export const Button = styled.button`
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  font-size: ${({ theme }) => theme.typography.body.fontSize};
  font-weight: 500;
  color: white;
  background: ${({ theme }) => theme.colors.darkGray};
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;