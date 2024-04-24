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

    if (!isMobileWebview() && event.origin != getTargetOrigin()) {
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
