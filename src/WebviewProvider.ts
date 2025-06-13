import { Address, Message, Transaction } from '@multiversx/sdk-core';
import { responseTypeMap } from '@multiversx/sdk-web-wallet-cross-window-provider/out/constants/windowProviderConstants';
import {
  SignMessageStatusEnum,
  WindowProviderRequestEnums,
  WindowProviderResponseEnums
} from '@multiversx/sdk-web-wallet-cross-window-provider/out/enums';
import {
  PostMessageParamsType,
  PostMessageReturnType,
  ReplyWithPostMessagePayloadType
} from '@multiversx/sdk-web-wallet-cross-window-provider/out/types';
import { getSafeDocument } from './helpers/getSafeDocument';
import { getSafeWindow } from './helpers/getSafeWindow';
import { getTargetOrigin } from './helpers/getTargetOrigin';
import { webviewProviderEventHandler } from './webviewProviderEventHandler';

interface IWebviewProviderOptions {
  resetStateCallback?: () => void;
}

export interface IProviderAccount {
  address: string;
  signature?: string;
  accessToken?: string;
}

const HANDSHAKE_RESPONSE_TIMEOUT = 1000;

export class WebviewProvider {
  private static _instance: WebviewProvider;
  private initialized = false;
  private account: IProviderAccount = { address: '' };
  private handshakeResponseTimeout: number = HANDSHAKE_RESPONSE_TIMEOUT;

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
        WindowProviderResponseEnums.resetStateResponse,
        (data) => {
          if (data.type === WindowProviderResponseEnums.resetStateResponse) {
            resetStateCallback?.();

            setTimeout(() => {
              this.finalizeResetState();
            }, 500);
          }
        }
      )
    );
  };

  private disconnect() {
    this.account = { address: '' };
  }

  /**
   * Initiates a handshake request with a window provider and waits for a response.
   *
   * This function sends a `finalizeHandshakeRequest` message and races it against a timeout.
   * If the handshake does not complete within the specified `HANDSHAKE_RESPONSE_TIMEOUT`,
   * the promise is rejected with a timeout error.
   */
  private initiateHandshake = async (
    version?: string
  ): Promise<
    PostMessageReturnType<WindowProviderRequestEnums.finalizeHandshakeRequest>
  > => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Timeout: Handshake took more than ${this.handshakeResponseTimeout}ms`
          )
        );
      }, this.handshakeResponseTimeout);
    });

    const handshakePromise = this.sendPostMessage({
      type: WindowProviderRequestEnums.finalizeHandshakeRequest,
      payload: version
    });

    try {
      const result = await Promise.race([handshakePromise, timeoutPromise]);
      return result;
    } catch (error) {
      console.error('Error initiating handshake', error);
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  private initiateReactNativeHandshake() {
    this.initialized = true;

    this.sendPostMessage({
      type: WindowProviderRequestEnums.finalizeHandshakeRequest,
      payload: undefined
    });

    return this.initialized;
  }

  init = async (version?: string) => {
    const safeWindow = getSafeWindow();

    // Backwards compatible for ReactNative
    if (safeWindow.ReactNativeWebView) {
      return this.initiateReactNativeHandshake();
    }

    try {
      const { type, payload } = await this.initiateHandshake(version);

      if (
        type === WindowProviderResponseEnums.finalizeHandshakeResponse &&
        payload.data
      ) {
        this.initialized = true;
      }
    } catch {
      // No handshake response received
    }

    return this.initialized;
  };

  login = async (options?: { token?: string }) => {
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }

    const response = await this.sendPostMessage({
      type: WindowProviderRequestEnums.loginRequest,
      payload: options?.token ? { token: options.token } : undefined
    });

    if (response.type == WindowProviderResponseEnums.cancelResponse) {
      console.warn('Cancelled the login action');
      await this.cancelAction();
      return null;
    }

    if (!response.payload.data) {
      console.error(
        'Error logging in',
        response.payload.error ?? 'No data received'
      );
      return null;
    }

    this.account = response.payload.data;
    return this.account;
  };

  logout = async () => {
    const response = await this.sendPostMessage({
      type: WindowProviderRequestEnums.logoutRequest,
      payload: undefined
    });

    this.initialized = false;
    this.disconnect();

    return Boolean(response.payload.data);
  };

  relogin = async () => {
    const response = await this.sendPostMessage({
      type: WindowProviderRequestEnums.reloginRequest,
      payload: undefined
    });

    if (response.type == WindowProviderResponseEnums.cancelResponse) {
      console.warn('Cancelled the re-login action');
      await this.cancelAction();
      return null;
    }

    if (!response.payload.data) {
      console.error(
        'Re-login Error',
        response.payload.error ?? 'No data received'
      );
      return null;
    }

    const { data, error } = response.payload;

    if (error || !data) {
      throw new Error('Unable to re-login');
    }

    const { accessToken } = data;

    if (!accessToken) {
      console.error('Unable to re-login. Missing accessToken.');
      return null;
    }

    this.account.accessToken = accessToken;
    return accessToken;
  };

  signTransactions = async (
    transactionsToSign: Transaction[]
  ): Promise<Transaction[] | null> => {
    const response = await this.sendPostMessage({
      type: WindowProviderRequestEnums.signTransactionsRequest,
      payload: transactionsToSign.map((tx) => tx.toPlainObject())
    });

    const { data: signedTransactions, error } = response.payload;

    if (error || !signedTransactions) {
      console.error('Unable to sign transactions');
      return null;
    }

    if (response.type == WindowProviderResponseEnums.cancelResponse) {
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

  signMessage = async (messageToSign: Message): Promise<Message | null> => {
    const response = await this.sendPostMessage({
      type: WindowProviderRequestEnums.signMessageRequest,
      payload: { message: Buffer.from(messageToSign.data).toString() }
    });

    const { data, error } = response.payload;

    if (error || !data) {
      console.error('Unable to sign message');
      return null;
    }

    if (response.type == WindowProviderResponseEnums.cancelResponse) {
      console.warn('Cancelled the message signing action');
      this.cancelAction();
      return null;
    }

    if (data.status !== SignMessageStatusEnum.signed) {
      console.error('Could not sign message');
      return null;
    }

    return new Message({
      data: Buffer.from(messageToSign.data),
      address:
        messageToSign.address ?? Address.fromBech32(this.account.address),
      signer: 'webview',
      version: messageToSign.version,
      signature: Buffer.from(String(data.signature), 'hex')
    });
  };

  cancelAction = async () => {
    return this.sendPostMessage({
      type: WindowProviderRequestEnums.cancelAction,
      payload: undefined
    });
  };

  finalizeResetState = async () => {
    return this.sendPostMessage({
      type: WindowProviderRequestEnums.finalizeResetStateRequest,
      payload: undefined
    });
  };

  setHandshakeResponseTimeout(timeout: number) {
    this.handshakeResponseTimeout = timeout;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isConnected(): boolean {
    return Boolean(this.account.address);
  }

  getAccount(): IProviderAccount | null {
    return this.account;
  }

  setAccount(account: IProviderAccount): void {
    this.account = account;
  }

  sendPostMessage = async <T extends WindowProviderRequestEnums>(
    message: PostMessageParamsType<T>
  ): Promise<PostMessageReturnType<T>> => {
    const safeWindow = getSafeWindow();

    if (safeWindow.ReactNativeWebView) {
      safeWindow.ReactNativeWebView.postMessage(JSON.stringify(message));
    } else if (safeWindow.webkit) {
      safeWindow.webkit.messageHandlers?.jsHandler?.postMessage(
        JSON.stringify(message),
        getTargetOrigin()
      );
    } else if (safeWindow.parent) {
      safeWindow.parent.postMessage(message, getTargetOrigin());
    }

    return await this.waitingForResponse(responseTypeMap[message.type]);
  };

  private waitingForResponse = async <T extends WindowProviderResponseEnums>(
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
