# mx-sdk-js-webview-provider

This provider is used to interact with the MultiversX dApps in a webview environment.
It facilitates the communication between the host application (wallet) and the dApp.

## Distribution

[npm](https://www.npmjs.com/package/@multiversx/sdk-webview-provider)

## Installation

`sdk-webview-provider` is delivered via [npm](https://www.npmjs.com/package/@multiversx/sdk-webview-provider), therefore it can be installed as follows:

```
npm install @multiversx/sdk-webview-provider
```

### Building the library

In order to compile the library, run the following:

```
npm install
npm run compile
```

## Usage

### Parent window

```html
<html>

<head>
    <meta charset="utf-8">
    <title>Webview Provider Example</title>
</head>

<body>
    <iframe id="webviewChild" src="http://child_URL/webviewChild.html" style="width: 100%; height: 200px;"></iframe>

    <script>
        // SigningProvider is one of the possible signing providers (extension, hardware wallet, etc.)
        const signingProvider = new SigningProvider();

        const webviewChild = document.getElementById("webviewChild");
        const targetWindow = webviewChild.contentWindow;

        window.addEventListener("message", async e => {
            const { type, payload } = e.data;

            switch (type) {
                case "LOGIN_REQUEST":
                    const address = await signingProvider.login();
                    
                    // generate accessToken using native auth client
                    const accessToken = "ZXJkMXdqeXRmbjZ6aHFmY3NlanZod3Y3cTR1c2F6czVyeWMzajhoYzc4ZmxkZ2pueWN0OHdlanFrYXN1bmM.Ykc5allXeG9iM04wLmY2ODE3NzUxMDc1NmVkY2U0NWVjYTg0Yjk0NTQ0YTZlYWNkZmEzNmU2OWRmZDNiOGYyNGM0MDEwZDE5OTA3NTEuMzAwLmV5SjBhVzFsYzNSaGJYQWlPakUyTnpNNU56SXlORFI5.a29dba3f0d2fb4712cb662bc8050c87bf9f0e7fd28f3c98efe0fda074be5b087bd75c075243e832c2985a9da044496b2cff3c852c8c963f9d3d840aed8799c07";

                    targetWindow?.postMessage({
                        type: "LOGIN_RESPONSE",
                        payload: {
                            data: {
                                address,
                                accessToken
                            }
                        },
                    })
                    break;
                case "SIGN_TRANSACTIONS_REQUEST":
                    const transactions = payload;
                    const signedTransactions = await signingProvider.signTransactions(transactions);

                    targetWindow?.postMessage({
                        type: "SIGN_TRANSACTIONS_RESPONSE",
                        payload: {
                            data: signedTransactions
                        },
                    })
                    break;
                case "SIGN_MESSAGE_REQUEST":
                    const messageToSign = payload?.message;

                    const signedMessage = await signingProvider.signMessage(messageToSign);

                    targetWindow?.postMessage({
                        type: "SIGN_MESSAGE_RESPONSE",
                        payload: {
                            data: {
                                signature: signedMessage.signature,
                                status: "signed"
                            }
                        },
                    })
                    break;
                default:
                    // handle other message types
                    break;
            }
        })
    </script>
</body>
</html>
```

### Child window

```html
<html>

<head>
    <meta charset="utf-8">
    <title>Webview Provider Example (Child Window)</title>
</head>

<body>
    <div>
        <button onclick="webview.relogin()">Relogin</button>
        <button onclick="webview.signTransactions()">Sign transactions</button>
        <button onclick="webview.signMessage()">Sign message</button>
        <button onclick="webview.logout()">Logout</button>
    </div>

    <script>
        const webview = new WebviewProvider.getInstance({
            resetStateCallback: () => console.log("Reset state callback called"),
        });
    </script>
</body>

</html>
```

# !!! Important !!!
Using [WKWebView](https://developer.apple.com/documentation/webkit/wkwebview), you need to register an object to be the handler for a particular message: `jsHandler`. 

Every message (action like `login`, `signMessage`, etc.) sent from the child webview is using the `jsHandler` object to send the message to the parent window. Eg. `window.webkit.messageHandlers.jsHandler.postMessage({ type: "LOGIN_REQUEST" });`

It's developer's responsibility to handle the message in the parent window and call the appropriate method on the `webview` object.