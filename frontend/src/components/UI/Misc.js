import styled from "styled-components";

export const Controls = styled.div`
  width: 15rem;
  margin-left: auto;
  margin-right: auto;
  margin-top: ${props => props.theme.spacing.lg};
  margin-bottom: ${props => props.theme.spacing.md};
  display: flex;
  flex-direction: column;

  @media (max-width: 768px) {
    width: calc(100vw - 20%);
    max-width: max-content;
  }
`;

export const RoomControls = styled.div`
  height: 10rem;
`;

export const RoomControlsButtonGroup = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-top: ${props => props.theme.spacing.md};
  margin-bottom: ${props => props.theme.spacing.sm};

  @media (max-width: 512px) {
    height: 5rem;
    flex-direction: column;
    justify-content: space-around;
    margin-top: ${props => props.theme.spacing.sm};
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
  color: ${props => props.theme.colors.mediumGray};
`;

export const TurnInfo = styled.div`
  margin: ${props => props.theme.spacing.xs};
  font-size: ${props => props.theme.typography.body.fontSize};
  font-weight: ${props => props.theme.typography.heading.fontWeight};
  color: ${props => props.theme.colors.darkGray};
`;