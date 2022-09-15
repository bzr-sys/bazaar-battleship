<template>
  <teleport to="#service-worker-notification-container">
    <!-- `is-hidden` class removed in registerServiceWorker.ts -->
    <div
      id="service-worker-notification"
      class="service-worker-notification notification is-info is-hidden"
      role="alert"
    >
      <button class="delete" @click="closeNotification" aria-label="Close notification"></button>
      <!-- `innerText` set in registerServiceWorker.ts -->
      <div id="service-worker-notification-message"></div>
    </div>
  </teleport>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "AppServiceWorkerNotification",
  setup() {
    // Add class using the same approach as removing the class, in registerServiceWorker.ts,
    // to avoid complications and confusion by binding a class in Vue and also manipulating in vanilla js.
    const swnId = "service-worker-notification";
    const swnMsgId = "service-worker-notification-message";
    const isHiddenClass = "is-hidden";

    function closeNotification(): void {
      const swn = document.getElementById(swnId);
      const swnMsg = document.getElementById(swnMsgId);
      if (swn && swnMsg) {
        swn.classList.add(isHiddenClass);
        swnMsg.innerText = "";
      }
    }

    // For some reason the offline event doesn't fire in registerServiceWorker.ts,
    // so handle online/offline status notifications here.
    function showOnlineStatus(isOnline: boolean): void {
      const swn = document.getElementById(swnId);
      const swnMsg = document.getElementById(swnMsgId);
      if (swn && swnMsg) {
        if (isOnline) {
          swn.classList.add(isHiddenClass);
          swnMsg.innerText = "";
        } else {
          swn.classList.remove(isHiddenClass);
          swnMsg.innerText = "You are offline, but worry not! This app works offline.";
        }
      }
    }

    window.addEventListener("load", () => {
      // set the correct status when the page loads
      navigator.onLine ? showOnlineStatus(true) : showOnlineStatus(false);

      // listen for network status changes
      window.addEventListener("online", () => showOnlineStatus(true));
      window.addEventListener("offline", () => showOnlineStatus(false));
    });

    return { closeNotification };
  },
});
</script>

<style scoped lang="scss">
.service-worker-notification {
  position: fixed;
  bottom: 0.5em;
  right: 0.5em;
  z-index: 100;
  box-shadow: 0 0 4px #444;
}
</style>
