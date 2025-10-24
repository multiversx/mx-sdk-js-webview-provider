export const getPlatform = (safeWindow: any) => {
  if (safeWindow.parent && safeWindow.self !== safeWindow.top) {
    return "iframe";
  } else if (safeWindow.ReactNativeWebView) {
    return "webview";
  } else if (safeWindow.webkit) {
    return "webkit"
  }
  return undefined;
}
