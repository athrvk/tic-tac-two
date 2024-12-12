import React from 'react';
import styled from 'styled-components';
import { theme } from '../../styles/theme';

const HeaderContainer = styled.header`
    background-color: ${theme.colors.lightGray};
    color: ${theme.colors.text};
    padding: ${theme.spacing.lg};
    display: flex;
    justify-content: space-around;
    align-items: center;
    flex-wrap: wrap;
    @media (max-width: 768px) {
        flex-direction: column;
        text-align: center;
        padding: ${theme.spacing.md};
    }
`;

const Title = styled.h1`
    font-family: ${theme.typography.fontFamily};
    font-size: ${theme.typography.heading.fontSize};
    font-weight: ${theme.typography.heading.fontWeight};
    margin: 0;
    @media (max-width: 768px) {
        font-size: ${theme.typography.subheading.fontSize};
    }
`;

const Username = styled.span`
    font-family: ${theme.typography.fontFamily};
    font-size: ${theme.typography.body.fontSize};
    font-weight: ${theme.typography.body.fontWeight};
    @media (max-width: 768px) {
        font-size: ${theme.typography.subsubheading.fontSize};
        margin-top: ${theme.spacing.sm};
    }
`;

const Header = ({ username }) => {
    return (
        <HeaderContainer>
            <a href="/" style={{ textDecoration: 'none', color: theme.colors.text }}>
                <Title>tic tac two</Title>
            </a>
            <Username>hello {username}</Username>
        </HeaderContainer>
    );
};

export default Header;