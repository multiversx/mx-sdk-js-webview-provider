import { getTargetOrigin } from './helpers/getTargetOrigin';
import { CrossWindowProviderResponseEnums } from '@multiversx/sdk-dapp-utils/out/enums/crossWindowProviderEnums';
import { ReplyWithPostMessagePayloadType } from '@multiversx/sdk-dapp-utils/out/types/crossWindowProviderTypes';
import { isMobileWebview } from './helpers/isMobileWebview';
import { getSafeWindow } from './helpers/getSafeWindow';
import { getSafeDocument } from './helpers/getSafeDocument';

export type WebviewProviderEventDataType<
  T extends CrossWindowProviderResponseEnums
> = {
  type: T;
  payload: ReplyWithPostMessagePayloadType<T>;
};

export const webviewProviderEventHandler = <
  T extends CrossWindowProviderResponseEnums
>(
  action: T,
  resolve: (value: WebviewProviderEventDataType<T>) => void
) => {
  return (event: MessageEvent<WebviewProviderEventDataType<T> | string>) => {
    let eventData = event.data;

    try {
      eventData =
        isMobileWebview() && typeof eventData === 'string'
          ? JSON.parse(eventData)
          : eventData;
    } catch (err) {
      console.error('error parsing eventData', eventData);
    }

    const { type, payload } = eventData as {
      type: T;
      payload: ReplyWithPostMessagePayloadType<T>;
    };

    if (isMobileWebview()) {
      // We need to check the origin inside this if statement to prevent runtime errors.
      // Accessing event.target.origin from an iframe is restricted due to CORS, but is accessible from the mobile webview.
      if ((event.target as Window).origin != getSafeWindow().parent?.origin) {
        return;
      }
    } else if (event.origin != getTargetOrigin()) {
      return;
    }

    const isCurrentAction =
      action === type ||
      type === CrossWindowProviderResponseEnums.cancelResponse;

    if (!isCurrentAction) {
      return;
    }

    getSafeWindow().removeEventListener?.(
      'message',
      webviewProviderEventHandler(action, resolve)
    );
    getSafeDocument().removeEventListener?.(
      'message',
      webviewProviderEventHandler(action, resolve)
    );

    resolve({ type, payload });
  };
};
