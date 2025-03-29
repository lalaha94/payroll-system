import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './debug.js'; // Import the debug script

// Make sure the DOM element exists before rendering
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Could not find root element to mount React app");
  document.body.innerHTML = '<div style="text-align:center; margin-top:100px;"><h1>Error</h1><p>Could not find root element to mount React app</p></div>';
}
