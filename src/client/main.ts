/**
 * SPA entry point.
 * Initializes the app shell, sets up path-based routing, and detects viewport layout.
 * An auth gate runs first: the Worker requires a Bearer token on every API call.
 */

import { initRouter } from './router.js';
import { AppShell } from './components/AppShell.js';
import { LoginGate, getStoredToken, clearStoredToken, verifyToken } from './components/LoginGate.js';
import { installFetchAuth } from './services/api.js';
import { initPWA } from './services/pwa.js';
import { initTheme } from './services/theme.js';
import { parsePath } from './router.js';
import { PublicCollectionView, publicFeedPath, type PublicFeedData } from './components/collection/PublicCollectionView.js';
import { initI18n } from './services/i18n.js';

/**
 * Start the application (after successful authentication).
 */
async function startApp(appEl: HTMLElement): Promise<void> {
  // Attach the Bearer token to every /api/* request (many components use raw fetch)
  installFetchAuth();

  initI18n();

  initRouter();

  const shell = new AppShell(appEl);
  shell.init();

  // Initialize PWA support (Service Worker registration, update detection)
  initPWA();

  // Sync theme with server (the inline script in index.html already
  // applied the theme before paint, this just reconciles with Config_Store)
  initTheme();
}

/**
 * Show the login screen. On successful verification the app boots.
 */
function showLogin(appEl: HTMLElement): void {
  appEl.innerHTML = '';
  const gate = new LoginGate(appEl, () => {
    gate.destroy();
    void startApp(appEl);
  });
  gate.init();
}

/**
 * A visitor who is not signed in, on a folder or tag address, sees the public
 * page when that folder or tag is public. Returns true when it was shown.
 */
async function showPublicPage(appEl: HTMLElement): Promise<boolean> {
  const route = parsePath(window.location.pathname);
  if (route.path !== 'folder' && route.path !== 'tag') return false;
  try {
    const res = await fetch(publicFeedPath(window.location.pathname), { headers: { Accept: 'application/feed+json' } });
    if (!res.ok) return false;
    const data = (await res.json()) as PublicFeedData;
    appEl.innerHTML = '';
    new PublicCollectionView(appEl, data, window.location.pathname, () => showLogin(appEl));
    return true;
  } catch {
    return false;
  }
}

/**
 * Bootstrap the application: authenticate first, then start the app shell.
 */
function bootstrap(): void {
  initI18n();

  const appEl = document.getElementById('app');
  if (!appEl) {
    console.error('[CFRSS] #app mount point not found');
    return;
  }

  const saved = getStoredToken();
  if (saved) {
    // Re-validate the stored token; drop it if it has been revoked
    void verifyToken(saved).then(async (ok) => {
      if (ok) {
        await startApp(appEl);
      } else {
        clearStoredToken();
        showLogin(appEl);
      }
    });
  } else {
    void showPublicPage(appEl).then((shown) => {
      if (!shown) showLogin(appEl);
    });
  }
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
