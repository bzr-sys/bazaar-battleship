import { RethinkID, Options } from "@mostlytyped/rethinkid-js-sdk";

// e.g., https://mostlytyped.github.io/rethinkid-battleship/
const baseURL = window.location.origin + window.location.pathname;

console.log("app id", process.env.VUE_APP_APP_ID);

const config: Options = {
  appId: process.env.VUE_APP_APP_ID,
  loginRedirectUri: `${baseURL}`,
  onApiConnectError: function (rid: RethinkID) {
    rid.logOut();
  },
};

if (process.env.NODE_ENV == "development") {
  config.oAuthUri = "http://localhost:4444";
  config.dataApiUri = "http://localhost:4000";
}

export const rid = new RethinkID(config);
