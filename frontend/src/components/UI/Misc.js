import styled, { keyframes } from "styled-components";

export const Controls = styled.div`
  width: 17rem;
  margin-left: auto;
  margin-right: auto;
  margin-top: ${props => props.theme.spacing.md};
  margin-bottom: ${props => props.theme.spacing.md};
  display: flex;
  flex-direction: column;

  @media (max-width: 768px) {
    width: calc(100vw - 20%);
    max-width: max-content;
  }
`;

export const RoomControls = styled.div`
  margin-bottom: ${props => props.theme.spacing.md};
`;

export const RoomControlsButtonGroup = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${props => props.theme.spacing.sm};
  margin-top: ${props => props.theme.spacing.md};
  margin-bottom: ${props => props.theme.spacing.sm};

  & > * {
    flex: 1;
  }

  @media (max-width: 512px) {
    flex-direction: column;
    justify-content: space-around;
    margin-top: ${props => props.theme.spacing.sm};
  }
`;

export const OrDivider = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  margin: ${props => props.theme.spacing.sm} 0;
  color: ${props => props.theme.colors.muted};
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;

  &::before, &::after {
    content: '';
    flex: 1;
    border-top: 1px solid ${props => props.theme.colors.border};
  }
`;

export const Tagline = styled.h2`
  text-align: center;
  font-size: 1.7rem;
  font-weight: ${props => props.theme.typography.subsubheading.fontWeight};
  font-style: italic;
  letter-spacing: -0.01em;
  color: ${props => props.theme.colors.text};
  margin-top: ${props => props.theme.spacing.lg};

  @media (max-width: 768px) {
    font-size: 1.4rem;
    margin-top: ${props => props.theme.spacing.md};
  }
`;

export const RuleHint = styled.p`
  text-align: center;
  max-width: 21rem;
  font-size: 0.9rem;
  line-height: 1.6;
  color: ${props => props.theme.colors.muted};
`;

export const RoomCode = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: center;
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.lg};
  border: 1.5px dashed ${props => props.theme.colors.mediumGray};
  border-radius: 12px;
  background: ${props => props.theme.colors.surface};
  overflow-wrap: anywhere;
  max-width: 90vw;

  @media (max-width: 768px) {
    font-size: 1.25rem;
  }
`;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
`;

export const WaitingDots = styled.span`
  &::after {
    content: '...';
    animation: ${blink} 1.4s ease-in-out infinite;
  }
`;

export const GameInfo = styled.div`
  text-align: center;
  margin: ${props => props.theme.spacing.sm} 0;
  font-size: ${props => props.theme.typography.body.fontSize};
  color: ${props => props.theme.colors.darkGray};
`;

export const Message = styled.div`
  text-align: center;
  margin: ${props => props.theme.spacing.xs};
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.md};
  color: ${props => props.theme.colors.darkGray};
  background: ${props => props.theme.colors.hover};
  border-radius: 999px;
  overflow-wrap: anywhere;
  max-width: 90vw;
`;

export const TurnInfo = styled.div`
  margin: ${props => props.theme.spacing.xs};
  padding: ${props => props.$big
    ? `${props.theme.spacing.sm} ${props.theme.spacing.lg}`
    : `${props.theme.spacing.xs} ${props.theme.spacing.md}`};
  font-size: ${props => props.$big ? '1.3rem' : props.theme.typography.body.fontSize};
  font-weight: ${props => props.theme.typography.heading.fontWeight};
  color: ${props => props.$mine ? props.theme.colors.background : props.theme.colors.darkGray};
  background: ${props => props.$mine ? props.theme.colors.primary : 'transparent'};
  border: 1.5px solid ${props => props.$mine ? props.theme.colors.primary : props.theme.colors.border};
  border-radius: 999px;
  transition: background 0.2s ease, color 0.2s ease;
`;

export const MutedNote = styled.div`
  text-align: center;
  margin: ${props => props.theme.spacing.sm} 0;
  font-size: 0.85rem;
  color: ${props => props.theme.colors.muted};
`;
