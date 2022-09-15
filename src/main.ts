import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import { rid } from "@/rethinkid";
// import "./registerServiceWorker";

rid.onLogin = () => {
  console.log("onLogin is called");
  store.dispatch("autoSignIn");
};

createApp(App).use(store).use(router).mount("#app");
