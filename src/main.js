import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';

/**
 * Staged boot sequence (Psylocke N3): 1.2s of choreographed signal
 * acquisition before the app takes over the status line. Free cinema —
 * the app already speaks this HUD vocabulary.
 */
function runBootSequence() {
  const screen = document.getElementById('loading-screen');
  const status = screen?.querySelector('.loader-status');
  if (!screen || !status) return;
  screen.classList.add('booting');
  const stages = ['ACQUIRING SIGNAL', 'SYNCING GRID', 'GRID READY'];
  stages.forEach((text, i) => {
    setTimeout(() => {
      if (status.isConnected) status.textContent = text;
      if (i === stages.length - 1)
        setTimeout(() => screen.classList.remove('booting'), 600);
    }, i * 400);
  });
}

runBootSequence();

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

application.start().catch((error) => {
  console.error("God's Eye View initialization failed:", error);
  const loaderStatus = document.querySelector('#loading-screen .loader-status');
  loaderStatus.textContent = `Error: ${describeError(error)}`;
  loaderStatus.style.color = '#ff4444';
});

export { application };
