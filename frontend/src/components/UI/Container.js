import styled from 'styled-components';

export const Container = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
  padding-bottom: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: ${({ theme }) => theme.spacing.md};

  @media (max-width: 768px) {
    max-width: 100vw;
    padding: ${({ theme }) => theme.spacing.md};
    padding-bottom: 96px;
  }
`;