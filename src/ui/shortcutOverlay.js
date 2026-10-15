/**
 * `?` keyboard-shortcut overlay. Self-contained: creates its DOM lazily on
 * first toggle, removes on destroy. Lists the real bindings from
 * applicationShortcuts.js — update both together.
 */

const SHORTCUTS = Object.freeze([
  ['1 – 7', 'Map style presets'],
  ['H', 'Toggle HUD'],
  ['O', 'Toggle orbit'],
  ['V', 'Clean view'],
  ['F', 'Layers panel'],
  ['D', 'Cycle detection'],
  ['C', 'CCTV panel'],
  ['Space', 'Voice control (hold to speak)'],
  ['Esc', 'Dismiss search / close'],
  ['?', 'This overlay'],
]);

export function createShortcutOverlay(documentRef = document) {
  let root = null;

  function build() {
    root = documentRef.createElement('div');
    root.id = 'gev-shortcut-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Keyboard shortcuts');
    root.hidden = true;
    root.innerHTML = `
      <div class="gev-shortcut-card">
        <div class="gev-shortcut-header">
          <span>KEYBOARD SHORTCUTS</span>
          <button type="button" aria-label="Close shortcuts">×</button>
        </div>
        <dl>
          ${SHORTCUTS.map(
            ([key, label]) => `<div><dt>${key}</dt><dd>${label}</dd></div>`,
          ).join('')}
        </dl>
      </div>
    `;
    root.addEventListener('click', (event) => {
      if (event.target === root || event.target.closest('button'))
        toggle(false);
    });
    documentRef.body.appendChild(root);
  }

  function toggle(show) {
    if (!root) build();
    const next = show ?? root.hidden;
    root.hidden = !next;
  }

  return {
    toggle,
    destroy() {
      root?.remove();
      root = null;
    },
  };
}
