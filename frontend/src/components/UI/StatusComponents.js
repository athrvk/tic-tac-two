import styled from 'styled-components';

export const StatusContainer = styled.div`
  padding: ${props => props.theme.spacing.md};
`;

export const PageTitle = styled.h1`
  font-size: ${props => props.theme.typography.heading.fontSize};
  font-weight: ${props => props.theme.typography.heading.fontWeight};
  color: ${props => props.theme.colors.primary};
  text-align: center;
  margin-bottom: ${props => props.theme.spacing.lg};
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${props => props.theme.spacing.md};
  margin-bottom: ${props => props.theme.spacing.lg};
`;

export const StatCard = styled.div`
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: ${props => props.theme.spacing.md};
  text-align: center;
`;

export const StatValue = styled.div`
  font-size: ${props => props.theme.typography.subheading.fontSize};
  font-weight: ${props => props.theme.typography.subheading.fontWeight};
  color: ${props => props.theme.colors.primary};
  margin-bottom: ${props => props.theme.spacing.xs};
`;

export const StatLabel = styled.div`
  font-size: ${props => props.theme.typography.body.fontSize};
  color: ${props => props.theme.colors.darkText};
`;

export const RoomsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${props => props.theme.spacing.md};
`;

export const RoomCard = styled.div`
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: ${props => props.theme.spacing.md};
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

export const RoomHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${props => props.theme.spacing.md};
`;

export const RoomId = styled.h3`
  font-size: ${props => props.theme.typography.subsubheading.fontSize};
  font-weight: ${props => props.theme.typography.subsubheading.fontWeight};
  color: ${props => props.theme.colors.primary};
  margin: 0;
  font-family: monospace;
  word-break: break-all;
`;

export const RoomStatus = styled.span`
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.sm};
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  background: ${props => props.active ? props.theme.colors.primary : props.theme.colors.lightGray};
  color: ${props => props.active ? props.theme.colors.background : props.theme.colors.darkText};
  margin-left: auto;
`;

export const PlayersSection = styled.div`
  margin-bottom: ${props => props.theme.spacing.md};
`;

export const SectionTitle = styled.h4`
  font-size: 1rem;
  font-weight: 500;
  color: ${props => props.theme.colors.darkText};
  margin: 0 0 ${props => props.theme.spacing.sm} 0;
`;

export const PlayersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.xs};
`;

export const Player = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.sm};
  background: ${props => props.theme.colors.hover};
  border-radius: 4px;
`;

export const PlayerName = styled.span`
  color: ${props => props.theme.colors.primary};
  font-weight: 500;
`;

export const PlayerSymbol = styled.span`
  background: ${props => props.theme.colors.primary};
  color: ${props => props.theme.colors.background};
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 0.875rem;
`;

export const GameInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: ${props => props.theme.colors.darkText};
`;

export const TurnIndicator = styled.span`
  font-weight: 500;
  color: ${props => props.theme.colors.primary};
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: ${props => props.theme.spacing.lg};
  color: ${props => props.theme.colors.darkText};
  font-style: italic;
`;

export const ConnectionStatus = styled.div`
  position: fixed;
  top: ${props => props.theme.spacing.md};
  right: ${props => props.theme.spacing.md};
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.sm};
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  background: ${props => props.connected ? '#4CAF50' : '#f44336'};
  color: white;
  z-index: 1000;
`;