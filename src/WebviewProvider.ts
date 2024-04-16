import { SignableMessage } from '@multiversx/sdk-core/out/signableMessage';
import { Transaction } from '@multiversx/sdk-core/out/transaction';
import { webviewProviderEventHandler } from './webviewProviderEventHandler';
import {
  CrossWindowProviderRequestEnums,
  CrossWindowProviderResponseEnums,
  SignMessageStatusEnum
} from '@multiversx/sdk-dapp-utils/out/enums/crossWindowProviderEnums';
import {
  PostMessageParamsType,
  PostMessageReturnType,
  ReplyWithPostMessagePayloadType
} from '@multiversx/sdk-dapp-utils/out/types/crossWindowProviderTypes';
import { responseTypeMap } from '@multiversx/sdk-dapp-utils/out/constants/crossWindowProviderConstants';
import { getTargetOrigin } from './helpers/getTargetOrigin';
import { getSafeWindow } from './helpers/getSafeWindow';
import { getSafeDocument } from './helpers/getSafeDocument';
import type { IDAppProviderBase } from '@multiversx/sdk-dapp-utils/out/models/dappProviderBase';

interface IWebviewProviderOptions {
  resetStateCallback?: () => void;
}

export class WebviewProvider implements IDAppProviderBase {
  private static _instance: WebviewProvider;

  static getInstance(options?: IWebviewProviderOptions) {
    if (!WebviewProvider._instance) {
      WebviewProvider._instance = new WebviewProvider(options);
    }
    return WebviewProvider._instance;
  }

  constructor(options?: IWebviewProviderOptions) {
    if (options?.resetStateCallback) {
      this.resetState(options.resetStateCallback);
    }
  }

  private resetState = (resetStateCallback?: () => void) => {
    getSafeWindow().addEventListener?.(
      'message',
      webviewProviderEventHandler(
        CrossWindowProviderResponseEnums.resetStateResponse,
        (data) => {
          if (
            data.type === CrossWindowProviderResponseEnums.resetStateResponse
          ) {
            resetStateCallback?.();

            setTimeout(() => {
              this.finalizeResetState();
            }, 500);
          }
        }
      )
    );
  };

  init = async () => {
    this.sendPostMessage({
      type: CrossWindowProviderRequestEnums.finalizeHandshakeRequest,
      payload: undefined
    });

    return true;
  };

  login = async () => {
    return true;
  };

  logout = async () => {
    const response = await this.sendPostMessage({
      type: CrossWindowProviderRequestEnums.logoutRequest,
      payload: undefined
    });

    return Boolean(response.payload.data);
  };

  relogin = async () => {
    const response = await this.sendPostMessage({
      type: CrossWindowProviderRequestEnums.loginRequest,
      payload: undefined
    });

    const { data, error } = response.payload;

    if (error || !data) {
      throw new Error('Unable to re-login');
    }

    const { accessToken } = data;

    if (!accessToken) {
      console.error('Unable to re-login. Missing accessToken.');
      return null;
    }

    return accessToken;
  };

  signTransactions = async (
    transactionsToSign: Transaction[]
  ): Promise<Transaction[] | null> => {
    const response = await this.sendPostMessage({
      type: CrossWindowProviderRequestEnums.signTransactionsRequest,
      payload: transactionsToSign.map((tx) => tx.toPlainObject())
    });

    const { data: signedTransactions, error } = response.payload;

    if (error || !signedTransactions) {
      console.error('Unable to sign transactions');
      return null;
    }

    if (response.type == CrossWindowProviderResponseEnums.cancelResponse) {
      console.warn('Cancelled the transactions signing action');
      this.cancelAction();
      return null;
    }

    return signedTransactions.map((tx) => Transaction.fromPlainObject(tx));
  };

  signTransaction = async (transaction: Transaction) => {
    const response = await this.signTransactions([transaction]);
    return response?.[0];
  };

  signMessage = async (
    message: SignableMessage
  ): Promise<SignableMessage | null> => {
    const response = await this.sendPostMessage({
      type: CrossWindowProviderRequestEnums.signMessageRequest,
      payload: { message: message.message.toString() }
    });

    const { data, error } = response.payload;

    if (error || !data) {
      console.error('Unable to sign message');
      return null;
    }

    if (response.type == CrossWindowProviderResponseEnums.cancelResponse) {
      console.warn('Cancelled the message signing action');
      this.cancelAction();
      return null;
    }

    if (data.status !== SignMessageStatusEnum.signed) {
      console.error('Could not sign message');
      return null;
    }

    message.applySignature(Buffer.from(String(data.signature), 'hex'));

    return message;
  };

  cancelAction = async () => {
    return this.sendPostMessage({
      type: CrossWindowProviderRequestEnums.cancelAction,
      payload: undefined
    });
  };

  finalizeResetState = async () => {
    return this.sendPostMessage({
      type: CrossWindowProviderRequestEnums.finalizeResetStateRequest,
      payload: undefined
    });
  };

  isInitialized = () => true;

  isConnected = async () => Promise.resolve(true);

  sendPostMessage = async <T extends CrossWindowProviderRequestEnums>(
    message: PostMessageParamsType<T>
  ): Promise<PostMessageReturnType<T>> => {
    const safeWindow = getSafeWindow();

    if (safeWindow.ReactNativeWebView) {
      safeWindow.ReactNativeWebView.postMessage(
        JSON.stringify(message),
        getTargetOrigin()
      );
    } else if (safeWindow.webkit) {
      safeWindow.webkit.messageHandlers.postMessage(
        JSON.stringify(message),
        getTargetOrigin()
      );
    } else if (safeWindow.parent) {
      safeWindow.parent.postMessage(message, getTargetOrigin());
    }

    return await this.waitingForResponse(responseTypeMap[message.type]);
  };

  private waitingForResponse = async <
    T extends CrossWindowProviderResponseEnums
  >(
    action: T
  ): Promise<{
    type: T;
    payload: ReplyWithPostMessagePayloadType<T>;
  }> => {
    return await new Promise((resolve) => {
      getSafeWindow().addEventListener?.(
        'message',
        webviewProviderEventHandler(action, resolve)
      );
      getSafeDocument().addEventListener?.(
        'message',
        webviewProviderEventHandler(action, resolve)
      );
    });
  };
}
