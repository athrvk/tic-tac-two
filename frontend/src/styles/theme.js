// src/styles/theme.js
// Editorial "ink on paper" palette - high contrast, e-ink friendly,
// with two ink accents so X and O read at a glance.
export const theme = {
    colors: {
        primary: '#141414', // Ink black for high contrast
        secondary: '#8a8a8a', // Even darker gray for better differentiation from primary color
        background: '#f7f5f0', // Warm paper background, still Kindle Paperwhite friendly
        surface: '#ffffff', // Card / board cell surface
        darkBackground: '#333333', // Darker gray background for better contrast
        text: '#141414', // Ink text for high contrast
        darkText: '#393939',
        muted: '#6f6a60', // Warm gray for secondary text
        border: '#d9d4c9', // Warm light border for subtle contrast
        winner: '#141414', // Ink for high contrast
        hover: '#eceae3', // Warm light hover effect
        lightGray: '#e4e1d8', // Warm light shade (header/footer)
        mediumGray: '#a9a49a', // Warm medium shade
        darkGray: '#57534a', // Warm dark shade
        xInk: '#b3372a', // Red ink for X
        oInk: '#1f5f8b', // Blue ink for O
    },
    typography: {
        fontFamily: "'Georgia', serif", // Serif font for better readability on e-ink displays
        heading: {
            fontSize: '2rem',
            fontWeight: '800' // Bolder weight for headings
        },
        body: {
            fontSize: '1rem',
            fontWeight: '400'
        },
        subheading: {
            fontSize: '1.75rem',
            fontWeight: '500'
        },
        subsubheading: {
            fontSize: '1.25rem',
            fontWeight: '500'
        }
    },
    spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '2rem'
    }
};
