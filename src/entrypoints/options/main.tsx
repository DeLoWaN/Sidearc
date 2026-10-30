import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../assets/app.css';
import { OptionsApp } from '../../options/OptionsApp';
import { askWorker, OptionsContext } from '../../options/options-context';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <OptionsContext value={askWorker}>
      <OptionsApp />
    </OptionsContext>
  </React.StrictMode>,
);
