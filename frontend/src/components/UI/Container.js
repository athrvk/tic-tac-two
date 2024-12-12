import styled from 'styled-components';

export const Container = styled.div`
  max-width: 600px;
  max-height: 100vh;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
  padding-bottom: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.md};
  
  @media (max-width: 768px) {
    max-width: 100vw;
    padding: ${({ theme }) => theme.spacing.md};
  }
`;