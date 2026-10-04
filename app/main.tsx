import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import Remybot from './remybot';
import './globals.css';

createRoot(document.getElementById('root')!).render(<StrictMode><Remybot /></StrictMode>);
