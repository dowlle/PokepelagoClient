import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { parseTwitchTokenFromHash, clearHashFromUrl, storeTwitchToken, validateTwitchToken, storeTwitchUsername } from './services/twitchAuthService'

// Handle Twitch OAuth redirect (implicit grant returns token in URL hash)
const twitchToken = parseTwitchTokenFromHash();
if (twitchToken) {
    storeTwitchToken(twitchToken);
    clearHashFromUrl();
    // Validate token to get username (async, non-blocking)
    validateTwitchToken(twitchToken).then(result => {
        if (result) {
            storeTwitchUsername(result.login);
            window.dispatchEvent(new Event('pokepelago_twitch_auth_changed'));
        }
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
