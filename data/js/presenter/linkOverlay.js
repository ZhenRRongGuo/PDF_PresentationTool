import AppState from '../state.js';

let overlayState = null;
let navigationHandler = null;
let overlayGeneration = 0;

function getOverlay() {
  return document.getElementById('presenter-link-overlay');
}

export function clearPresenterLinkOverlay() {
  overlayGeneration += 1;
  const overlay = getOverlay();
  if (overlay) overlay.replaceChildren();
  overlayState = null;
}

export function setPresenterLinkNavigationHandler(handler) {
  navigationHandler = typeof handler === 'function' ? handler : null;
}

async function resolveDestination(destination) {
  if (!AppState.pdfDocument || destination == null) return null;
  try {
    const resolved = typeof destination === 'string'
      ? await AppState.pdfDocument.getDestination(destination)
      : destination;
    if (!resolved || !resolved[0]) return null;
    const pageIndex = await AppState.pdfDocument.getPageIndex(resolved[0]);
    return pageIndex + 1;
  } catch (error) {
    console.warn('[presenter] Could not resolve PDF destination:', error);
    return null;
  }
}

function getCrop(renderResult) {
  const { renderViewport } = renderResult;
  if (AppState.isBeamerSplitMode) {
    return {
      x: 0,
      y: 0,
      width: renderViewport.width / 2,
      height: renderViewport.height,
    };
  }
  if (AppState.isGDocsSplitMode && AppState.gDocsSlideRect) {
    return {
      x: renderViewport.width * AppState.gDocsSlideRect.x,
      y: renderViewport.height * AppState.gDocsSlideRect.y,
      width: renderViewport.width * AppState.gDocsSlideRect.w,
      height: renderViewport.height * AppState.gDocsSlideRect.h,
    };
  }
  return {
    x: 0,
    y: 0,
    width: renderViewport.width,
    height: renderViewport.height,
  };
}

function positionLinks() {
  if (!overlayState || AppState.currentPage !== overlayState.pageNum) return;
  const { canvas, renderViewport, crop, links } = overlayState;
  if (!canvas || canvas.style.display === 'none' || !links.length) return;

  const canvasRect = canvas.getBoundingClientRect();
  if (!canvasRect.width || !canvasRect.height) return;

  const scaleX = canvasRect.width / crop.width;
  const scaleY = canvasRect.height / crop.height;

  links.forEach(({ element, annotation }) => {
    const [rawX1, rawY1, rawX2, rawY2] = renderViewport.convertToViewportRectangle(annotation.rect);
    const x1 = Math.max(0, Math.min(crop.width, Math.min(rawX1, rawX2) - crop.x));
    const y1 = Math.max(0, Math.min(crop.height, Math.min(rawY1, rawY2) - crop.y));
    const x2 = Math.max(0, Math.min(crop.width, Math.max(rawX1, rawX2) - crop.x));
    const y2 = Math.max(0, Math.min(crop.height, Math.max(rawY1, rawY2) - crop.y));

    element.style.left = `${canvasRect.left + x1 * scaleX}px`;
    element.style.top = `${canvasRect.top + y1 * scaleY}px`;
    element.style.width = `${Math.max(0, (x2 - x1) * scaleX)}px`;
    element.style.height = `${Math.max(0, (y2 - y1) * scaleY)}px`;
  });
}

export function refreshPresenterLinkOverlay() {
  positionLinks();
}

/**
 * Render clickable PDF annotation rectangles over the presenter's current
 * slide. The links use the same cropped viewport as the current preview, so
 * Beamer notes and Google Docs notes remain outside the clickable area.
 */
export async function renderPresenterLinkOverlay(renderResult, onNavigate = navigationHandler) {
  clearPresenterLinkOverlay();
  const generation = overlayGeneration;
  const overlay = getOverlay();
  if (!overlay || !renderResult || !AppState.pdfDocument) return;

  const { pageNum, page, renderViewport } = renderResult;
  if (pageNum !== AppState.currentPage || !page || !renderViewport) return;

  let annotations;
  try {
    annotations = await page.getAnnotations({ intent: 'display' });
  } catch (error) {
    console.warn('[presenter] Could not read PDF link annotations:', error);
    return;
  }

  if (generation !== overlayGeneration || pageNum !== AppState.currentPage) return;
  const linkAnnotations = annotations.filter((annotation) =>
    annotation.subtype === 'Link' && (annotation.url || annotation.dest),
  );
  if (!linkAnnotations.length) return;

  const canvas = document.getElementById('current-slide-canvas');
  if (!canvas) return;
  const crop = getCrop(renderResult);
  const links = [];

  linkAnnotations.forEach((annotation) => {
    const link = document.createElement('a');
    link.href = annotation.url || '#';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', annotation.url ? 'Open PDF link' : 'Go to linked slide');
    link.title = annotation.url ? 'Open link' : 'Go to linked slide';
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (annotation.url) {
        window.open(annotation.url, '_blank', 'noopener,noreferrer');
        return;
      }
      const targetPage = await resolveDestination(annotation.dest);
      if (targetPage && typeof onNavigate === 'function') onNavigate(targetPage);
    });
    overlay.appendChild(link);
    links.push({ element: link, annotation });
  });

  overlayState = { pageNum, canvas, renderViewport, crop, links };
  positionLinks();
}
