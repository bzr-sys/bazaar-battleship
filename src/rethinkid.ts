import { RethinkID } from "@rethinkid/rethinkid-js-sdk";
import type { Options } from "@rethinkid/rethinkid-js-sdk";

// e.g., https://mostlytyped.github.io/rethinkid-battleship/
const baseURL = window.location.origin + window.location.pathname;

const appId = import.meta.env.VITE_APP_ID;

console.log("app id", appId);

const config: Options = {
  appId: appId,
  loginRedirectUri: `${baseURL}`,
  onApiConnectError: async function (rid: RethinkID, message: string) {
    console.log("OnConnectError", message);
    rid.logOut();
  },
};

if (import.meta.env.DEV) {
  config.rethinkIdUri = "http://localhost:3377";
}

export const rid = new RethinkID(config);
