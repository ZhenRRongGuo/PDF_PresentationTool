export const uiState = {
  // The default gives the current/next stack 64% of the main area and
  // keeps a wide, readable notes pane on the right.
  slidesSplitRatio: 0.56,
  contentSplitRatio: 0.64,
  layoutMode: (() => {
    try { return localStorage.getItem('pdf-presenter-layout') || 'notes-right'; }
    catch (_) { return 'notes-right'; }
  })(),
  notesZoom: 1.2,
  notesCollapsed: false,
  sidebarCollapsed: false,
  nextSlideCollapsed: false,
  laserActive: false,
  spotlightActive: false,
  drawActive: false,
  drawColor: '#ff2020',
  drawWidth: 3,
  drawEraser: false,
  zoomActive: false,
  zoomApplied: false,
  progressBarVisible: true,
  qaQuestions: [],
  clockIntervalId: null,
  windowCheckIntervalId: null,
  pointerRafPending: false,
  drawPoints: [],
  presenterDrawCtx: null,
  isDrawing: false,
  zoomRafPending: false,
  breakActive: false,
  breakStartTime: null,
  breakDuration: 0,
  breakTimerId: null,
  qaActive: false,
  webcamActive: false,
  webcamPosition: 'top-right',
};
