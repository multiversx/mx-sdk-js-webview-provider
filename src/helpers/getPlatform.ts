import { getSafeWindow } from './getSafeWindow';

export enum PlatformsEnum {
  IFRAME = 'iframe',
  WEBVIEW = 'webview',
  WEBKIT = 'webkit'
}

export const getPlatform = (): PlatformsEnum | null => {
  const safeWindow = getSafeWindow();

  if (safeWindow.parent && safeWindow.self !== safeWindow.top) {
    return PlatformsEnum.IFRAME;
  }

  if (safeWindow.ReactNativeWebView) {
    return PlatformsEnum.WEBVIEW;
  }

  if (safeWindow.webkit) {
    return PlatformsEnum.WEBKIT;
  }

  return null;
};
