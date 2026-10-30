import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../assets/app.css';
import { OptionsApp } from '../../options/OptionsApp';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
