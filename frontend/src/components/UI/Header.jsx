import React from 'react';
import styled from 'styled-components';
import { theme } from '../../styles/theme';

const HeaderContainer = styled.header`
    background-color: ${theme.colors.background};
    color: ${theme.colors.text};
    padding: ${theme.spacing.md} ${theme.spacing.lg};
    border-bottom: 3px double ${theme.colors.primary};
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    @media (max-width: 768px) {
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: ${theme.spacing.md};
    }
`;

const Title = styled.h1`
    font-family: ${theme.typography.fontFamily};
    font-size: ${theme.typography.heading.fontSize};
    font-weight: ${theme.typography.heading.fontWeight};
    margin: 0;
    letter-spacing: -0.01em;

    em {
        font-style: italic;
        color: ${theme.colors.xInk};
    }

    @media (max-width: 768px) {
        font-size: ${theme.typography.subheading.fontSize};
    }
`;

const Username = styled.span`
    font-family: ${theme.typography.fontFamily};
    font-size: 0.9rem;
    font-weight: ${theme.typography.body.fontWeight};
    color: ${theme.colors.muted};
    font-style: italic;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    @media (max-width: 768px) {
        margin-top: ${theme.spacing.xs};
        max-width: 80vw;
    }
`;

const Header = ({ username }) => {
    return (
        <HeaderContainer>
            <a href="/" style={{ textDecoration: 'none', color: theme.colors.text }}>
                <Title>tic tac <em>two</em></Title>
            </a>
            <Username>playing as {username}</Username>
        </HeaderContainer>
    );
};

export default Header;
