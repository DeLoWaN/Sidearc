import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../assets/app.css';
import { App } from '../../panel/App';
import { connectToWorker } from '../../panel/connection';

connectToWorker().catch(console.error);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
