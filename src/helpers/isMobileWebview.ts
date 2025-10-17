import { getSafeWindow } from './getSafeWindow';

export const isMobileWebview = (): boolean => {
  const safeWindow = getSafeWindow();

  if (safeWindow.ReactNativeWebView) {
    return true;
  }

  const userAgent = safeWindow.navigator?.userAgent || '';
  const isIosWebView =
    /iP(hone|od|ad)/.test(userAgent) &&
    /AppleWebKit/.test(userAgent) &&
    !/Safari/.test(userAgent);

  const isAndroidWebView =
    /Android/.test(userAgent) &&
    (/wv/.test(userAgent) || /Version\/[\d.]+/.test(userAgent));

  return isIosWebView || isAndroidWebView;
};
