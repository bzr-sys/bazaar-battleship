/* eslint-disable no-console */

import { register } from "register-service-worker";

const swnId = "service-worker-notification";
const swnMsgId = "service-worker-notification-message";

if (process.env.NODE_ENV === "production") {
  register(`${process.env.BASE_URL}service-worker.js`, {
    ready() {
      console.log(
        "App is being served from cache by a service worker.\n" + "For more details, visit https://goo.gl/AFskqB",
      );
    },
    registered() {
      console.log("Service worker has been registered.");
    },
    cached() {
      console.log("Content has been cached for offline use.");

      const swn = document.getElementById(swnId);
      const swnMsg = document.getElementById(swnMsgId);
      if (swn && swnMsg) {
        swn.classList.remove("is-hidden");
        swnMsg.innerText = "App has been installed, it now works offline!";
      }
    },
    updatefound() {
      console.log("New content is downloading.");

      const swn = document.getElementById(swnId);
      const swnMsg = document.getElementById(swnMsgId);
      if (swn && swnMsg) {
        swn.classList.remove("is-hidden");
        swnMsg.innerText = "New content is downloading.";
      }
    },
    updated() {
      console.log("New content is available; please refresh.");

      const swn = document.getElementById(swnId);
      const swnMsg = document.getElementById(swnMsgId);
      if (swn && swnMsg) {
        swn.classList.remove("is-hidden");
        swnMsg.innerText = "New content is available; please refresh.";
      }
    },
    offline() {
      // This does not seem to fire when offline.
      console.log("No internet connection found. App is running in offline mode.");
    },
    error(error) {
      console.error("Error during service worker registration:", error);
    },
  });
}
