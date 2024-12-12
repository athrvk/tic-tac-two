// src/styles/theme.js
export const theme = {
    colors: {
        primary: '#000000', // Black for high contrast
        secondary: '#d1d1d1', // Darker gray for differentiation from primary color
        background: '#f6f6f6', // Light gray background for Kindle Paperwhite compatibility
        text: '#000000', // Black text for high contrast
        darkText: '#393939',
        border: '#cccccc', // Light gray border for subtle contrast
        winner: '#000000', // Black for high contrast
        hover: '#e0e0e0', // Light gray for hover effect
        lightGray: '#d3d3d3', // Additional light gray shade
        mediumGray: '#a9a9a9', // Additional medium gray shade
        darkGray: '#696969' // Additional dark gray shade
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