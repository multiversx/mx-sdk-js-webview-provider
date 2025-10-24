import { getPlatform, PlatformsEnum } from './getPlatform';

export const isMobileWebview = () => {
  const platform = getPlatform();
  // webkit removed because of false positive detection on iOS Chrome mobile browser
  return platform === PlatformsEnum.WEBVIEW;
};
