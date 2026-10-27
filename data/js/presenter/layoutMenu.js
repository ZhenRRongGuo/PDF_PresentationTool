import { getLayoutOptions, setLayoutMode } from './layouts.js';
import { t } from '../i18n.js';
import { uiState } from './uiState.js';

export function showLayoutMenu() {
  const existing = document.getElementById('layout-modal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'layout-modal';
  modal.className = 'modal-overlay';
  const panel = document.createElement('div');
  panel.className = 'modal-panel';
  panel.innerHTML = `<h3>${t('layoutTitle')}</h3><p style="color:var(--text-muted);margin-bottom:1rem;">${t('layoutDescription')}</p>`;

  Object.entries(getLayoutOptions()).forEach(([mode, label]) => {
    const button = document.createElement('button');
    button.className = 'screen-option-btn';
    button.textContent = label;
    button.dataset.active = mode === uiState.layoutMode ? 'true' : 'false';
    button.addEventListener('click', () => {
      setLayoutMode(mode);
      modal.remove();
    });
    panel.appendChild(button);
  });

  const close = document.createElement('button');
  close.className = 'modal-cancel-btn';
  close.textContent = t('close');
  close.addEventListener('click', () => modal.remove());
  panel.appendChild(close);
  modal.appendChild(panel);
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
}
