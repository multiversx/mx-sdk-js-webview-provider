import { isMobileWebview } from './helpers/isMobileWebview';
import { WindowProviderResponseEnums } from '@multiversx/sdk-web-wallet-cross-window-provider/out/enums/windowProviderEnums';
import { ReplyWithPostMessagePayloadType } from '@multiversx/sdk-web-wallet-cross-window-provider/out/types/windowProviderTypes';

export type WebviewProviderEventDataType<
  T extends WindowProviderResponseEnums
> = {
  type: T;
  payload: ReplyWithPostMessagePayloadType<T>;
};

export const webviewProviderEventHandler = <
  T extends WindowProviderResponseEnums
>(
  action: T,
  resolve: (value: WebviewProviderEventDataType<T>) => void,
  allowedOrigin: string
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

    if (!isMobileWebview() && event.origin !== allowedOrigin) {
      return;
    }

    const isCurrentAction =
      action === type || type === WindowProviderResponseEnums.cancelResponse;

    if (!isCurrentAction) {
      return;
    }

    resolve({ type, payload });
  };
};
