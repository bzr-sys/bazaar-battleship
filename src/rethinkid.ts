import RethinkID from "@mostlytyped/rethinkid-js-sdk";

const baseURL = window.location.origin;

console.log("app id", process.env.VUE_APP_APP_ID);

const config = {
  appId: process.env.VUE_APP_APP_ID,
  loginRedirectUri: `${baseURL}`,
  dataAPIConnectErrorCallback: function () {
    // this = RethinkID
    // @ts-ignore
    this.logOut();
  },
  onLogin: function () {
    console.log("onLogin is called");
    // TODO is there a good way to do this?
    //store.dispatch("autoSignIn");
  },

  rethinkIdBaseUri: "http://localhost:4444",
  socketioUri: "http://localhost:4000",
};

export const rid = new RethinkID(config);
