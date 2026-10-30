import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../assets/app.css';
import { App } from '../../panel/App';
import { connectToWorker } from '../../panel/connection';
import { PanelContext } from '../../panel/panel-context';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// The page shows nothing until the connection knows the window of the panel.
connectToWorker()
  .then((connection) =>
    root.render(
      <React.StrictMode>
        <PanelContext value={connection}>
          <App />
        </PanelContext>
      </React.StrictMode>,
    ),
  )
  .catch(console.error);
