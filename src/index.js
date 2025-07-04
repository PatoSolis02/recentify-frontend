import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';

const repoName = '/recentify-frontend'; // <-- your GitHub repo name with slashes

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter basename={repoName}>
    <App />
  </BrowserRouter>
);
