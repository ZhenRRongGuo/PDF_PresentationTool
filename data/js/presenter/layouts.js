import { uiState } from './uiState.js';
import { els } from './elements.js';
import { renderAllPreviews } from './slides.js';
import { t } from '../i18n.js';

const LAYOUTS = {
  'notes-right': 'layoutNotesRight',
  'notes-bottom': 'layoutNotesBottom',
  'notes-left': 'layoutNotesLeft',
  'notes-top': 'layoutNotesTop',
};

export function applySplitLayout() {
  const root = document.documentElement;
  const presenter = els.presenterView || document.getElementById('presenter-view');
  if (presenter) presenter.dataset.layout = uiState.layoutMode;
  root.style.setProperty('--slides-split', `${uiState.slidesSplitRatio * 100}%`);
  root.style.setProperty('--content-split', `${uiState.contentSplitRatio * 100}%`);
}

export function setLayoutMode(mode) {
  if (!LAYOUTS[mode]) return;
  uiState.layoutMode = mode;
  try { localStorage.setItem('pdf-presenter-layout', mode); } catch (_) {}
  applySplitLayout();
  setTimeout(() => renderAllPreviews(), 50);
}

export function getLayoutOptions() {
  return Object.fromEntries(Object.entries(LAYOUTS).map(([mode, key]) => [mode, t(key)]));
}

export function initLayoutSplitter(splitterEl) {
  if (!splitterEl) return;
  let startPos = 0;
  let startRatio = 0;
  let parentSize = 0;

  function axis() {
    const slides = splitterEl.id === 'slides-splitter';
    return slides
      ? ((uiState.layoutMode === 'notes-bottom' || uiState.layoutMode === 'notes-top') ? 'x' : 'y')
      : ((uiState.layoutMode === 'notes-bottom' || uiState.layoutMode === 'notes-top') ? 'y' : 'x');
  }

  function onMouseDown(event) {
    event.preventDefault();
    const isSlides = splitterEl.id === 'slides-splitter';
    const direction = axis();
    const parent = splitterEl.parentElement;
    startPos = direction === 'x' ? event.clientX : event.clientY;
    startRatio = isSlides ? uiState.slidesSplitRatio : uiState.contentSplitRatio;
    parentSize = direction === 'x' ? parent.clientWidth : parent.clientHeight;
    document.body.classList.add('resizing');
    document.body.dataset.resizeAxis = direction;
    splitterEl.classList.add('active');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(event) {
    const isSlides = splitterEl.id === 'slides-splitter';
    const direction = axis();
    const current = direction === 'x' ? event.clientX : event.clientY;
    const delta = (current - startPos) / Math.max(parentSize, 1);
    const invert = !isSlides && (uiState.layoutMode === 'notes-left' || uiState.layoutMode === 'notes-top');
    const ratio = Math.max(0.2, Math.min(0.8, startRatio + (invert ? -delta : delta)));
    if (isSlides) uiState.slidesSplitRatio = ratio;
    else uiState.contentSplitRatio = ratio;
    applySplitLayout();
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.classList.remove('resizing');
    delete document.body.dataset.resizeAxis;
    splitterEl.classList.remove('active');
    renderAllPreviews();
  }

  splitterEl.addEventListener('mousedown', onMouseDown);
}
