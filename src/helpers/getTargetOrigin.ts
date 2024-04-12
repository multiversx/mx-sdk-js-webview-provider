import { isWindowAvailable } from "@multiversx/sdk-dapp-utils/out/helpers/isWindowAvailable";

export const getTargetOrigin = () => {
  if (isWindowAvailable()) {
    const ancestorOrigins = window.location.ancestorOrigins;
    return ancestorOrigins?.[ancestorOrigins.length - 1] ?? "*";
  }

  return "*";
};
