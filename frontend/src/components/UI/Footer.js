import React from 'react';
import styled from 'styled-components';
import { theme } from '../../styles/theme';

const FooterContainer = styled.footer`
    background-color: ${theme.colors.lightGray};
    position: fixed;
    width: 100%;
    bottom: 0;
    color: ${theme.colors.text};
    padding: ${theme.spacing.md};
    display: flex;
    justify-content: space-around;
    align-items: center;
    flex-wrap: wrap;
    @media (max-width: 768px) {
        flex-direction: column;
        text-align: center;
        padding: ${theme.spacing.xs};
    }
`;

const FooterText = styled.p`
    font-family: ${theme.typography.fontFamily};
    font-size: ${theme.typography.body.fontSize};
    font-weight: ${theme.typography.body.fontWeight};
    margin: 0;
    @media (max-width: 768px) {
        font-size: ${theme.typography.body.fontSize};
        margin-top: ${theme.spacing.xs};
    }
`;

const FooterLink = styled.a`
    color: ${theme.colors.primary};
    text-decoration: none;
    margin-left: ${theme.spacing.xs};
    &:hover {
        color: ${theme.colors.hover};
    }
`;

const Footer = () => {
    return (
        <FooterContainer>
            <FooterText>
                Created by
                <FooterLink href="https://github.com/athrvk" target="_blank" rel="noopener noreferrer">
                    @athrvk
                </FooterLink>
            </FooterText>
            <FooterText>
                <FooterLink href="https://www.freepik.com/icon/tic-tac-toe_771293#fromView=keyword&page=1&position=8&uuid=834ad41f-7e69-4774-b32f-25e21b2ed4f8" target="_blank" rel="noopener noreferrer">
                    icon by Freepik
                </FooterLink>
            </FooterText>
        </FooterContainer>
    );
};

export default Footer;