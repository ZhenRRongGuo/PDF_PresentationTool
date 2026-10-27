const translations = {
  'zh-CN': {
    'menu.file': '文件',
    'menu.view': '视图',
    'menu.window': '窗口',
    'menu.help': '帮助',
    'menu.settings': '设置',
    'menu.file.changeFile': '更换文件…',
    'menu.file.startPresentation': '开始/停止放映',
    'menu.view.layout': '演讲者布局',
    'menu.view.sidebar': '切换缩略图栏',
    'menu.view.notes': '切换备注面板',
    'menu.view.next': '切换下一页预览',
    'menu.window.startPresentation': '开始/停止放映',
    'menu.help.shortcuts': '键盘快捷键',
    'menu.settings.language': '界面语言',
    navigator: '导航器',
    currentItem: '当前页',
    nextItem: '下一页',
    notes: '备注',
    noNotes: '此页没有备注。',
    layoutTitle: '演讲者布局',
    layoutDescription: '选择布局后，可以拖动分隔条调整大小。',
    layoutNotesRight: '备注在右侧',
    layoutNotesBottom: '备注在底部',
    layoutNotesLeft: '备注在左侧',
    layoutNotesTop: '备注在顶部',
    close: '关闭',
    shortcuts: '快捷键',
    presenterLayout: '演讲者布局',
    changeFile: '更换文件',
    coffeeBreak: '休息计时',
    blackoutScreen: '黑屏 (B)',
    unblackoutScreen: '取消黑屏 (B)',
    recordPresentation: '录制演示',
    webcamSubtitles: '摄像头与字幕',
    startStopPresentation: '开始/停止放映',
    previousSlide: '上一页',
    nextSlide: '下一页',
    startTimer: '开始计时',
    pauseTimer: '暂停计时',
    resetTimer: '重置计时',
    toggleNotes: '切换备注面板',
    zoomOut: '缩小备注',
    resetZoom: '重置备注缩放',
    zoomIn: '放大备注',
    'language.simplifiedChinese': '简体中文',
    'language.english': 'English',
  },
  en: {
    'menu.file': 'File',
    'menu.view': 'View',
    'menu.window': 'Window',
    'menu.help': 'Help',
    'menu.settings': 'Settings',
    'menu.file.changeFile': 'Change File…',
    'menu.file.startPresentation': 'Start/Stop Presentation',
    'menu.view.layout': 'Presenter Layout',
    'menu.view.sidebar': 'Toggle Thumbnail Sidebar',
    'menu.view.notes': 'Toggle Notes Panel',
    'menu.view.next': 'Toggle Next Preview',
    'menu.window.startPresentation': 'Start/Stop Presentation',
    'menu.help.shortcuts': 'Keyboard Shortcuts',
    'menu.settings.language': 'Interface Language',
    navigator: 'Navigator',
    currentItem: 'Current Item',
    nextItem: 'Next Item',
    notes: 'Notes',
    noNotes: 'No notes available for this slide.',
    layoutTitle: 'Presenter Layout',
    layoutDescription: 'Choose a layout, then drag the splitters to adjust it.',
    layoutNotesRight: 'Notes Right',
    layoutNotesBottom: 'Notes Bottom',
    layoutNotesLeft: 'Notes Left',
    layoutNotesTop: 'Notes Top',
    close: 'Close',
    shortcuts: 'Shortcuts',
    presenterLayout: 'Presenter Layout',
    changeFile: 'Change File',
    coffeeBreak: 'Coffee Break',
    blackoutScreen: 'Blackout Screen (B)',
    unblackoutScreen: 'Unblackout Screen (B)',
    recordPresentation: 'Record Presentations',
    webcamSubtitles: 'Webcam and subtitles',
    startStopPresentation: 'Start/Stop Presentation',
    previousSlide: 'Previous Slide',
    nextSlide: 'Next Slide',
    startTimer: 'Start Timer',
    pauseTimer: 'Pause Timer',
    resetTimer: 'Reset Timer',
    toggleNotes: 'Toggle Notes Panel',
    zoomOut: 'Zoom Out',
    resetZoom: 'Reset Zoom',
    zoomIn: 'Zoom In',
    'language.simplifiedChinese': '简体中文',
    'language.english': 'English',
  },
};

let currentLanguage = (() => {
  try { return localStorage.getItem('pdf-presenter-language') || 'zh-CN'; }
  catch (_) { return 'zh-CN'; }
})();

function languageTable() {
  return translations[currentLanguage] || translations['zh-CN'];
}

export function getLanguage() {
  return currentLanguage;
}

export function t(key) {
  return languageTable()[key] || translations.en[key] || key;
}

export function applyLanguage(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((element) => {
    const value = t(element.dataset.i18nTitle);
    element.title = value;
    if (element.dataset.tooltip !== undefined) element.dataset.tooltip = value;
  });
  document.documentElement.lang = currentLanguage === 'zh-CN' ? 'zh-CN' : 'en';
}

export function setLanguage(language) {
  if (!translations[language] || language === currentLanguage) {
    applyLanguage();
    return;
  }
  currentLanguage = language;
  try { localStorage.setItem('pdf-presenter-language', language); } catch (_) {}
  applyLanguage();
  window.dispatchEvent(new CustomEvent('presenter-language-change', {
    detail: { language: currentLanguage },
  }));
}
