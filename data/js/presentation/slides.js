import { state } from './state.js';

function captureForFade() {
  if (state.transitionType !== 'fade') return null;

  const canvas = document.getElementById('slide-canvas');
  const video = document.getElementById('slide-video');
  const img = document.getElementById('slide-image');

  let activeEl = null;
  if (canvas && canvas.style.display !== 'none') activeEl = canvas;
  else if (video && video.style.display !== 'none') activeEl = video;
  else if (img && img.style.display !== 'none') activeEl = img;

  if (!activeEl) return null;

  const overlay = document.createElement('canvas');
  overlay.className = 'slide-transition-fade';
  overlay.style.position = 'absolute';
  overlay.style.top = '50%';
  overlay.style.left = '50%';
  overlay.style.transform = 'translate(-50%, -50%)';
  overlay.style.zIndex = '2';
  overlay.style.pointerEvents = 'none';

  if (activeEl === canvas) {
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    overlay.style.width = canvas.style.width || canvas.clientWidth + 'px';
    overlay.style.height = canvas.style.height || canvas.clientHeight + 'px';
    overlay.getContext('2d').drawImage(canvas, 0, 0);
  } else {
    const rect = activeEl.getBoundingClientRect();
    overlay.width = rect.width * (window.devicePixelRatio || 1);
    overlay.height = rect.height * (window.devicePixelRatio || 1);
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.getContext('2d').drawImage(activeEl, 0, 0, overlay.width, overlay.height);
  }

  document.body.appendChild(overlay);
  return overlay;
}

function triggerFadeOut(overlay) {
  if (!overlay) return;
  requestAnimationFrame(() => {
    overlay.classList.add('slide-fade-out');
    setTimeout(() => overlay.remove(), 400); 
  });
}


export function tryAutoFullscreen() {
  // Kept as a compatibility hook for the state-sync path. Fullscreen is
  // intentionally user initiated so the audience window can be repositioned
  // after monitor selection.
}

export function toggleFullscreen() {
  if (window.desktopAPI?.isElectron) {
    window.desktopAPI.toggleFullscreen();
    return;
  }
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

export function endPresentation() {
  if (window.desktopAPI?.isElectron) {
    window.desktopAPI.closePresentation();
    return;
  }
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  window.close();
}

function clearLinkOverlay() {
  const overlay = document.getElementById('link-overlay');
  if (overlay) overlay.replaceChildren();
}

function broadcastAudienceJump(page) {
  const message = {
    type: 'audience-jump',
    payload: { page },
    _presenterSync: true,
  };
  if (window.opener && !window.opener.closed) {
    try { window.opener.postMessage(message, '*'); } catch (_) {}
  }
  // BroadcastChannel is required for Electron's native child window, where
  // postMessage is not always delivered through window.opener.
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('pdf-presenter-sync');
    channel.postMessage(message);
    setTimeout(() => channel.close(), 100);
  }
}

async function resolveDestination(destination) {
  if (!state.pdfDocument || destination == null) return null;
  try {
    const resolved = typeof destination === 'string'
      ? await state.pdfDocument.getDestination(destination)
      : destination;
    if (!resolved || !resolved[0]) return null;
    const pageIndex = await state.pdfDocument.getPageIndex(resolved[0]);
    return pageIndex + 1;
  } catch (error) {
    console.warn('[presentationUI] Could not resolve PDF destination:', error);
    return null;
  }
}

async function renderLinkOverlay(page, renderViewport, crop) {
  const overlay = document.getElementById('link-overlay');
  const canvas = document.getElementById('slide-canvas');
  if (!overlay || !canvas || !state.pdfDocument) return;
  overlay.replaceChildren();

  let annotations;
  try {
    annotations = await page.getAnnotations({ intent: 'display' });
  } catch (error) {
    console.warn('[presentationUI] Could not read PDF link annotations:', error);
    return;
  }
  if (page.pageNumber !== state.currentPage) return;

  const links = annotations.filter((annotation) =>
    annotation.subtype === 'Link' && (annotation.url || annotation.dest),
  );
  if (!links.length) return;

  const canvasRect = canvas.getBoundingClientRect();
  const cropX = crop?.x || 0;
  const cropY = crop?.y || 0;
  const visibleWidth = crop?.width || renderViewport.width;
  const visibleHeight = crop?.height || renderViewport.height;
  const scaleX = canvasRect.width / visibleWidth;
  const scaleY = canvasRect.height / visibleHeight;

  for (const annotation of links) {
    const [rawX1, rawY1, rawX2, rawY2] = renderViewport.convertToViewportRectangle(annotation.rect);
    const x1 = Math.max(0, Math.min(visibleWidth, Math.min(rawX1, rawX2) - cropX));
    const y1 = Math.max(0, Math.min(visibleHeight, Math.min(rawY1, rawY2) - cropY));
    const x2 = Math.max(0, Math.min(visibleWidth, Math.max(rawX1, rawX2) - cropX));
    const y2 = Math.max(0, Math.min(visibleHeight, Math.max(rawY1, rawY2) - cropY));
    if (x2 <= x1 || y2 <= y1) continue;

    const link = document.createElement('a');
    link.href = annotation.url || '#';
    link.setAttribute('aria-label', annotation.url ? 'Open PDF link' : 'Go to linked slide');
    link.style.left = `${canvasRect.left + x1 * scaleX}px`;
    link.style.top = `${canvasRect.top + y1 * scaleY}px`;
    link.style.width = `${(x2 - x1) * scaleX}px`;
    link.style.height = `${(y2 - y1) * scaleY}px`;

    link.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (annotation.url) {
        window.open(annotation.url, '_blank', 'noopener,noreferrer');
        return;
      }
      const targetPage = await resolveDestination(annotation.dest);
      if (targetPage) broadcastAudienceJump(targetPage);
    });
    overlay.appendChild(link);
  }
}

function renderCurrentPageLinks(page, renderViewport) {
  const isBeamer = state.isBeamerSplitMode;
  const isGDocs = state.isGDocsSplitMode && state.gDocsSlideRect;
  let crop = null;
  if (isBeamer) {
    crop = { x: 0, y: 0, width: renderViewport.width / 2, height: renderViewport.height };
  } else if (isGDocs) {
    crop = {
      x: renderViewport.width * state.gDocsSlideRect.x,
      y: renderViewport.height * state.gDocsSlideRect.y,
      width: renderViewport.width * state.gDocsSlideRect.w,
      height: renderViewport.height * state.gDocsSlideRect.h,
    };
  }
  requestAnimationFrame(() => renderLinkOverlay(page, renderViewport, crop));
}

let hasRenderedOnce = false;

export async function loadPDF(blobUrl) {
  try {
    const pdfjsLib = window.pdfjsLib;
    const canvas = document.getElementById('slide-canvas');
    
    // Hide totally at boot to prevent showing visually miscalculated layouts 
    // while the browser window is requesting and animating into Fullscreen.
    if (canvas && !hasRenderedOnce) {
      canvas.style.opacity = '0';
      canvas.style.transition = 'none';
    }

    state.pdfDocument = await pdfjsLib.getDocument({ url: blobUrl }).promise;

    if (!hasRenderedOnce) {
      hasRenderedOnce = true;
      // 300ms for tryAutoFullscreen trigger + 300ms for the OS animation to finish
      setTimeout(async () => {
        await renderCurrentSlide();
        if (canvas) {
          canvas.style.transition = 'opacity 0.6s ease';
          canvas.style.opacity = '1';
        }
      }, 600);
    } else {
      renderCurrentSlide();
    }
  } catch (err) {
    console.error('[presentationUI] Failed to load PDF:', err);
  }
}

export async function renderCurrentSlide() {
  const slideCanvas = document.getElementById('slide-canvas');
  const slideVideo = document.getElementById('slide-video');
  const slideImage = document.getElementById('slide-image');
  if (!slideCanvas || !slideVideo || !slideImage) return;

  const fadeOverlay = captureForFade();

  if (state.mediaType === 'video' || state.mediaType === 'image') {
    clearLinkOverlay();
    const isVid = state.mediaType === 'video';
    
    slideCanvas.style.display = 'none';
    slideVideo.style.display = isVid ? '' : 'none';
    slideImage.style.display = isVid ? 'none' : '';
    
    if (!isVid) slideVideo.pause();
    
    // Switch media source if needed
    if (state.currentPage >= 1 && state.currentPage <= state.totalPages) {
      const currentMediaUrl = state.playlist[state.currentPage - 1];
      if (isVid) {
        if (slideVideo.src !== currentMediaUrl) {
          slideVideo.onloadeddata = () => triggerFadeOut(fadeOverlay);
          slideVideo.src = currentMediaUrl;
        } else {
          triggerFadeOut(fadeOverlay);
        }
      } else {
        if (slideImage.src !== currentMediaUrl) {
          slideImage.onload = () => triggerFadeOut(fadeOverlay);
          slideImage.src = currentMediaUrl;
        } else {
          triggerFadeOut(fadeOverlay);
        }
      }
    } else {
      triggerFadeOut(fadeOverlay);
    }
    return;
  }

  // Restore PDF mode visibility
  slideCanvas.style.display = '';
  slideVideo.style.display = 'none';
  slideVideo.pause();
  slideImage.style.display = 'none';

  if (!state.pdfDocument || state.currentPage < 1) {
    clearLinkOverlay();
    return;
  }

  if (state.activeRenderTask) {
    try { state.activeRenderTask.cancel(); } catch (_) {}
    state.activeRenderTask = null;
  }

  const page = await state.pdfDocument.getPage(state.currentPage);
  const baseViewport = page.getViewport({ scale: 1 });

  const isBeamer = state.isBeamerSplitMode;
  const isGDocs = state.isGDocsSplitMode;
  const clip = isBeamer ? 'left' : (isGDocs ? 'top' : null);

  let effectiveWidth = baseViewport.width;
  let effectiveHeight = baseViewport.height;
  if (isBeamer) {
    effectiveWidth = baseViewport.width / 2;
  } else if (isGDocs && state.gDocsSlideRect) {
    effectiveWidth = baseViewport.width * state.gDocsSlideRect.w;
    effectiveHeight = baseViewport.height * state.gDocsSlideRect.h;
  }

  const maxW = window.innerWidth;
  const maxH = window.innerHeight;
  const scale = Math.min(maxW / effectiveWidth, maxH / effectiveHeight);

  const renderViewport = page.getViewport({ scale });

  if (isBeamer) {
    slideCanvas.width = Math.floor(renderViewport.width / 2);
    slideCanvas.height = Math.floor(renderViewport.height);
  } else if (isGDocs && state.gDocsSlideRect) {
    slideCanvas.width = Math.floor(renderViewport.width * state.gDocsSlideRect.w);
    slideCanvas.height = Math.floor(renderViewport.height * state.gDocsSlideRect.h);
  } else {
    slideCanvas.width = Math.floor(renderViewport.width);
    slideCanvas.height = Math.floor(renderViewport.height);
  }

  const ctx = slideCanvas.getContext('2d');
  ctx.clearRect(0, 0, slideCanvas.width, slideCanvas.height);

  if (isBeamer) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, slideCanvas.width, slideCanvas.height);
    ctx.clip();
  } else if (isGDocs && state.gDocsSlideRect) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, slideCanvas.width, slideCanvas.height);
    ctx.clip();
    const offsetX = -(renderViewport.width * state.gDocsSlideRect.x);
    const offsetY = -(renderViewport.height * state.gDocsSlideRect.y);
    ctx.translate(offsetX, offsetY);
  }

  const renderTask = page.render({
    canvasContext: ctx,
    viewport: renderViewport,
  });
  state.activeRenderTask = renderTask;

  try {
    await renderTask.promise;
    renderCurrentPageLinks(page, renderViewport);
    triggerFadeOut(fadeOverlay);
  } catch (err) {
    if (err && err.name === 'RenderingCancelledException') {
      if (fadeOverlay) fadeOverlay.remove();
      return;
    }
    if (fadeOverlay) fadeOverlay.remove();
    throw err;
  } finally {
    if (state.activeRenderTask === renderTask) state.activeRenderTask = null;
  }

  if (isBeamer || (isGDocs && state.gDocsSlideRect)) {
    ctx.restore();
  }
}

export function setBlackout(active) {
  const blackoutOverlay = document.getElementById('blackout-overlay');
  if (blackoutOverlay) {
    blackoutOverlay.classList.toggle('visible', !!active);
  }
}
