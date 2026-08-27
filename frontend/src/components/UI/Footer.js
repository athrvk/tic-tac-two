import React from 'react';
import styled from 'styled-components';
import { theme } from '../../styles/theme';

const FooterContainer = styled.footer`
    background-color: ${theme.colors.background};
    position: fixed;
    width: 100%;
    bottom: 0;
    color: ${theme.colors.muted};
    padding: ${theme.spacing.sm};
    border-top: 1px solid ${theme.colors.border};
    display: flex;
    justify-content: center;
    gap: ${theme.spacing.md};
    align-items: center;
    flex-wrap: wrap;
`;

const FooterText = styled.p`
    font-family: ${theme.typography.fontFamily};
    font-size: 0.8rem;
    font-weight: ${theme.typography.body.fontWeight};
    margin: 0;
`;

const FooterLink = styled.a`
    color: ${theme.colors.darkGray};
    text-decoration: none;
    margin-left: ${theme.spacing.xs};
    &:hover {
        color: ${theme.colors.primary};
        text-decoration: underline;
    }
`;

const Footer = () => {
    return (
        <FooterContainer>
            <FooterText>
                created by
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
