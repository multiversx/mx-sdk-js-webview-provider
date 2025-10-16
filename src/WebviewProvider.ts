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
  private allowedOrigin = '*';

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
        },
        this.allowedOrigin
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

    const handshakePromise = new Promise<any>((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        if (
          event.data?.type ===
          WindowProviderResponseEnums.finalizeHandshakeResponse
        ) {
          this.allowedOrigin = event.origin;
          getSafeWindow().removeEventListener('message', handler);
          resolve(event.data);
        }
      };

      // Added message listener in order to intercept origin in which we handle the communication
      getSafeWindow().addEventListener('message', handler);

      this.sendPostMessage({
        type: WindowProviderRequestEnums.finalizeHandshakeRequest,
        payload: version
      });

      timeoutId = setTimeout(() => {
        getSafeWindow().removeEventListener('message', handler);
        reject(
          new Error(
            `Timeout: Handshake took more than ${this.handshakeResponseTimeout}ms`
          )
        );
      }, this.handshakeResponseTimeout);
    });

    return await handshakePromise;
  };

  init = async (version?: string) => {
    console.log('STARTING HANDSHAKE');
    try {
      const { type, payload } = await this.initiateHandshake(version);

      console.log({ type, payload });
      if (
        type === WindowProviderResponseEnums.finalizeHandshakeResponse &&
        payload.data
      ) {
        this.initialized = true;
      }
    } catch {
      console.log('NO RESPONSE RECEIVED');
      // No handshake response received
    }

    console.log('INITIALIZED =>>>>', this, this.initialized);
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
      this.cancelAction();
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
      this.cancelAction();
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

    return signedTransactions.map((tx) => Transaction.newFromPlainObject(tx));
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
        messageToSign.address ?? Address.newFromBech32(this.account.address),
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

    const isInIframe = safeWindow.self !== safeWindow.top;
    console.log('isInIframe', { isInIframe }, { hasParent: safeWindow.parent });
    if (safeWindow.parent && isInIframe) {
      safeWindow.parent.postMessage(message, this.allowedOrigin);
    } else if (safeWindow.ReactNativeWebView) {
      console.log('sending message from dApp to RN');
      safeWindow.ReactNativeWebView.postMessage(JSON.stringify(message));
    } else if (safeWindow.webkit) {
      safeWindow.webkit.messageHandlers?.jsHandler?.postMessage(
        JSON.stringify(message),
        this.allowedOrigin
      );
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
      const handler = webviewProviderEventHandler(
        action,
        (data) => {
          resolve(data);
          getSafeWindow().removeEventListener('message', handler);
          getSafeDocument().removeEventListener('message', handler);
        },
        this.allowedOrigin
      );

      getSafeWindow().addEventListener('message', handler);
      getSafeDocument().addEventListener('message', handler);
    });
  };
}
