import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: { background: '#1e40af', color: '#fff', borderRadius: '8px', fontSize: '14px' },
        success: { style: { background: '#065f46', color: '#fff' } },
        error: { style: { background: '#991b1b', color: '#fff' } },
      }}
    />
  </React.StrictMode>
);
