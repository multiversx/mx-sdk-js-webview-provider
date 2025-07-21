import { getSafeWindow } from './getSafeWindow';

export const isMobileWebview = () => {
  const safeWindow = getSafeWindow();
  // webkit removed because of false positive detection on iOS Chrome mobile browser
  return safeWindow.ReactNativeWebView; // || safeWindow.webkit;
};
