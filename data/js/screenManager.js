/**
 * screenManager.js — Multi-Monitor & Presentation Window
 *
 * Uses the Screen Enumeration API (window.getScreenDetails) when available.
 * Falls back to a simple window.open with manual positioning.
 */

import comm from './communication.js';
import AppState from './state.js';

class ScreenManager {
  constructor() {
    /** @type {Window|null} */
    this.presentationWindow = null;
    /** @type {ScreenDetailed[]|null} */
    this.screens = null;
  }

  /**
   * Query available hardware screens.
   * Returns an array of ScreenDetailed objects or null if API unavailable.
   */
  async getAvailableScreens() {
    // Electron can enumerate displays without relying on the browser's
    // permission-gated Window Management API.
    if (window.desktopAPI?.getDisplays) {
      try {
        this.screens = await window.desktopAPI.getDisplays();
        return this.screens;
      } catch (err) {
        console.warn('[screenManager] Electron display enumeration failed:', err);
      }
    }

    try {
      if ('getScreenDetails' in window) {
        const details = await window.getScreenDetails();
        const screens = Array.from(details.screens);
        const secondary = screens.find((item) => !item.isPrimary) || screens[0];
        this.screens = [
          {
            id: 'default',
            label: 'Default (secondary display)',
            isDefault: true,
            isPrimary: false,
            availLeft: secondary?.availLeft,
            availTop: secondary?.availTop,
            availWidth: secondary?.availWidth,
            availHeight: secondary?.availHeight,
            width: secondary?.width || 1024,
            height: secondary?.height || 768,
          },
          ...screens,
        ];
        return this.screens;
      }
    } catch (err) {
      console.warn('[screenManager] Screen Enumeration API not available:', err);
    }
    // Single-screen/browser fallback. Keeping an explicit option makes the
    // selection step predictable even when display enumeration is unavailable.
    this.screens = [{
      id: 'default',
      label: 'Default (current display)',
      isDefault: true,
      isPrimary: true,
      width: window.screen?.width || 1024,
      height: window.screen?.height || 768,
    }];
    return this.screens;
  }

  /**
   * Open the Presentation window (presentation.html).
   *
   * @param {ScreenDetailed|null} screen  target screen (null = default)
   * @returns {Promise<Window>}
   */
  async openPresentationWindow(screen) {
    this.closePresentationWindow();

    let features;
    if (screen?.workArea) {
      const area = screen.workArea;
      features = [
        `left=${area.x}`,
        `top=${area.y}`,
        `width=${area.width}`,
        `height=${area.height}`,
      ].join(',');
    } else if (screen?.bounds) {
      const area = screen.workArea || screen.bounds;
      features = [
        `left=${area.x}`,
        `top=${area.y}`,
        `width=${area.width}`,
        `height=${area.height}`,
      ].join(',');
    } else if (screen && screen.availLeft !== undefined) {
      features = [
        `left=${screen.availLeft}`,
        `top=${screen.availTop}`,
        `width=${screen.availWidth}`,
        `height=${screen.availHeight}`,
      ].join(',');
    } else {
      features = 'width=1024,height=768';
    }

    this.presentationWindow = window.open(
      'presentation.html',
      'PresentationWindow',
      features,
    );

    if (!this.presentationWindow) {
      throw new Error(
        'Failed to open presentation window. Please allow popups for this site.',
      );
    }

    this.presentationWindow.focus();

    comm.setWindowRef(this.presentationWindow);
    AppState.setState({ selectedScreen: screen || 'default' });

    // Once the new window loads, push state only. The user decides when to
    // enter fullscreen, so the window remains draggable after selection.
    this.presentationWindow.addEventListener('load', () => {
      comm.broadcast('state-sync', AppState.getSerializableState());
    });

    return this.presentationWindow;
  }

  /**
   * Close current window, open on a new screen.
   */
  async switchScreen(newScreen) {
    this.closePresentationWindow();
    return this.openPresentationWindow(newScreen);
  }

  closePresentationWindow() {
    if (this.presentationWindow && !this.presentationWindow.closed) {
      this.presentationWindow.close();
    }
    this.presentationWindow = null;
  }

  isPresentationOpen() {
    return this.presentationWindow && !this.presentationWindow.closed;
  }
}

const screenManager = new ScreenManager();
export default screenManager;
