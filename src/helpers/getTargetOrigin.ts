import { isWindowAvailable } from './isWindowAvailable';

export const getTargetOrigin = () => {
  if (isWindowAvailable()) {
    const ancestorOrigins = window.location.ancestorOrigins;
    return ancestorOrigins?.[ancestorOrigins.length - 1] ?? '*';
  }

  return '*';
};
