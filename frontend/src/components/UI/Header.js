import React from 'react';
import styled from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { theme } from '../../styles/theme';

const HeaderContainer = styled.header`
    background-color: ${theme.colors.lightGray};
    color: ${theme.colors.text};
    padding: ${theme.spacing.lg};
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    @media (max-width: 768px) {
        flex-direction: column;
        text-align: center;
        padding: ${theme.spacing.md};
    }
`;

const LeftSection = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
`;

const RightSection = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
    @media (max-width: 768px) {
        margin-top: ${theme.spacing.md};
    }
`;

const Title = styled.h1`
    font-family: ${theme.typography.fontFamily};
    font-size: ${theme.typography.heading.fontSize};
    font-weight: ${theme.typography.heading.fontWeight};
    margin: 0;
    cursor: pointer;
    &:hover {
        color: ${theme.colors.darkText};
    }
    @media (max-width: 768px) {
        font-size: ${theme.typography.subheading.fontSize};
    }
`;

const NavButton = styled.button`
    background: ${theme.colors.primary};
    color: ${theme.colors.background};
    border: none;
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    border-radius: 4px;
    font-family: ${theme.typography.fontFamily};
    font-size: ${theme.typography.body.fontSize};
    cursor: pointer;
    transition: background-color 0.2s ease;
    
    &:hover {
        background: ${theme.colors.darkText};
    }
    
    &:disabled {
        background: ${theme.colors.lightGray};
        color: ${theme.colors.darkText};
        cursor: not-allowed;
    }
`;

const BackButton = styled(NavButton)`
    background: ${theme.colors.lightGray};
    color: ${theme.colors.primary};
    border: 1px solid ${theme.colors.border};
    
    &:hover {
        background: ${theme.colors.hover};
    }
`;

const Username = styled.span`
    font-family: ${theme.typography.fontFamily};
    font-size: ${theme.typography.body.fontSize};
    font-weight: ${theme.typography.body.fontWeight};
    @media (max-width: 768px) {
        font-size: ${theme.typography.subsubheading.fontSize};
    }
`;

const Header = ({ username, showBackLink = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const isStatusPage = location.pathname === '/status';

    const handleTitleClick = () => {
        navigate('/');
    };

    const handleStatusClick = () => {
        navigate('/status');
    };

    const handleBackClick = () => {
        navigate(-1);
    };

    return (
        <HeaderContainer>
            <LeftSection>
                {showBackLink && (
                    <BackButton onClick={handleBackClick}>
                        ← Back
                    </BackButton>
                )}
                <Title onClick={handleTitleClick}>tic tac two</Title>
            </LeftSection>
            <RightSection>
                {!isStatusPage && (
                    <NavButton onClick={handleStatusClick}>
                        Status Dashboard
                    </NavButton>
                )}
                <Username>hello {username}</Username>
            </RightSection>
        </HeaderContainer>
    );
};

export default Header;