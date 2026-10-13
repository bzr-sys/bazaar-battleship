<script setup lang="ts">
import { RouterView } from "vue-router";
import AppNav from "@/components/AppNav.vue";
import { useBazaarStore } from "@/stores/bazaar";
import { bzr } from "@/bazaar";

const store = useBazaarStore();

bzr.onLogin(async () => {
  store.autoSignIn();
});

store.autoSignIn();
</script>

<template>
  <AppNav />
  <RouterView v-if="store.loaded" />
  <p v-else class="hd mx-auto max-w-[1240px] px-6 py-10 text-sonar-dim" role="status">Connecting…</p>
</template>
