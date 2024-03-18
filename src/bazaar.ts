import { BazaarApp, type BazaarOptions } from "@bzr/bazaar";

// e.g., https://bzr-sys.github.io/bazaar-battleship/
const baseURL = window.location.origin + window.location.pathname;

const appId = import.meta.env.VITE_APP_ID;

console.log("app id", appId);

const config: BazaarOptions = {
  appId: appId,
  loginRedirectUri: `${baseURL}`,
  onApiConnectError: async function (bzr: BazaarApp, message: string) {
    console.log("OnConnectError", message);
    bzr.logOut();
  },
};

if (import.meta.env.DEV) {
  config.bazaarUri = "http://localhost:3377";
}

export const bzr = new BazaarApp(config);
