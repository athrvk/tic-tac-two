import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// import './styles/index.css';


if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);