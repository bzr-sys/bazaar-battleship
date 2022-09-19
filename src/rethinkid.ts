import RethinkID from "@mostlytyped/rethinkid-js-sdk";
import { Options } from "@mostlytyped/rethinkid-js-sdk/dist/types/types";

// e.g., https://mostlytyped.github.io/rethinkid-battleship/
const baseURL = window.location.origin + window.location.pathname;

console.log("app id", process.env.VUE_APP_APP_ID);

const config: Options = {
  appId: process.env.VUE_APP_APP_ID,
  loginRedirectUri: `${baseURL}`,
  dataAPIConnectErrorCallback: function () {
    // this = RethinkID
    // @ts-ignore
    this.logOut();
  },
};

if (process.env.NODE_ENV == "development") {
  config.oAuthUri = "http://localhost:4444";
  config.dataApiUri = "http://localhost:4000";
}

export const rid = new RethinkID(config);
