<template>
  <AppNav />
  <div class="container m-auto">
    <RouterView v-if="store.loaded" />
    <div class="loading" v-else>Loading...</div>
  </div>
</template>

<script setup lang="ts">
import { RouterView } from "vue-router";
import AppNav from "@/components/AppNav.vue";
import { useBazaarStore } from "@/stores/bazaar";

const store = useBazaarStore();

import { bzr } from "@/bazaar";
bzr.onLogin(async () => {
  console.log("onLogin is called");
  store.autoSignIn();
});

store.autoSignIn();
</script>
