import { applyLanguage, setLanguage } from '../i18n.js';
import { showLayoutMenu } from './layoutMenu.js';
import { showHelpModal } from './modals.js';
import { handleStartPresentation } from './screens.js';
import { toggleNotesCollapse, toggleSidebarCollapse, toggleNextSlideCollapse } from './splitters.js';

function closeMenus() {
  document.querySelectorAll('.menu-item.open').forEach((item) => item.classList.remove('open'));
}

function runAction(action) {
  switch (action) {
    case 'change-file':
      document.getElementById('pdf-input')?.click();
      break;
    case 'start-presentation':
      handleStartPresentation();
      break;
    case 'layout':
      showLayoutMenu();
      break;
    case 'sidebar':
      toggleSidebarCollapse();
      break;
    case 'notes':
      toggleNotesCollapse();
      break;
    case 'next':
      toggleNextSlideCollapse();
      break;
    case 'shortcuts':
      showHelpModal();
      break;
    case 'language-zh':
      setLanguage('zh-CN');
      break;
    case 'language-en':
      setLanguage('en');
      break;
    default:
      break;
  }
  closeMenus();
}

export function initMenuBar() {
  const bar = document.getElementById('menu-bar');
  if (!bar || bar.dataset.bound === 'true') return;
  bar.dataset.bound = 'true';

  bar.querySelectorAll('.menu-trigger').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const item = trigger.closest('.menu-item');
      const wasOpen = item.classList.contains('open');
      closeMenus();
      if (!wasOpen) item.classList.add('open');
    });
  });

  bar.querySelectorAll('[data-menu-action]').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      runAction(item.dataset.menuAction);
    });
  });

  document.addEventListener('click', closeMenus);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenus();
  });
  window.addEventListener('presenter-language-change', () => applyLanguage(bar));
  applyLanguage(bar);
}
