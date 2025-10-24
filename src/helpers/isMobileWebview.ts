import { getSafeWindow } from './getSafeWindow';
import { getPlatform, PlatformsEnum } from './getPlatform';

export const isMobileWebview = () => {
  const safeWindow = getSafeWindow();
  // webkit removed because of false positive detection on iOS Chrome mobile browser
  return getPlatform() === PlatformsEnum.WEBVIEW;
};
