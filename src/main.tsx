import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import '@fontsource-variable/inter';
import './ui/styles.css';
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
