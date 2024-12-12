import styled from "styled-components";

export const Controls = styled.div`
  margin-left: auto;
  margin-right: auto;
  margin-top: ${props => props.theme.spacing.lg};
  margin-bottom: ${props => props.theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.lg};
`;

export const RoomControls = styled.div`
  gap: ${({ theme }) => theme.spacing.md};
`;

export const RoomControlsButtonGroup = styled.div`
  display: flex;
  flex-direction: row;
  margin-top: ${props => props.theme.spacing.sm};
  gap: ${({ theme }) => theme.spacing.md};
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
  color: ${props => props.theme.colors.mediumGray};
`;

export const TurnInfo = styled.div`
  margin: ${props => props.theme.spacing.xs};
  font-size: ${props => props.theme.typography.body.fontSize};
  font-weight: ${props => props.theme.typography.heading.fontWeight};
  color: ${props => props.theme.colors.darkGray};
`;