import { getSafeWindow } from './getSafeWindow';

export const isMobileWebview = (): boolean => {
  const safeWindow = getSafeWindow();

  if (safeWindow.ReactNativeWebView) {
    return true;
  }

  const userAgent = safeWindow.navigator?.userAgent || '';
  const isMobileAgent = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);

  return isMobileAgent;
};
