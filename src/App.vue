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
import { useRethinkIdStore } from "@/stores/rethinkid";

const store = useRethinkIdStore();

import { rid } from "@/rethinkid";
rid.onLogin(async () => {
  console.log("onLogin is called");
  store.autoSignIn();
});

store.autoSignIn();
</script>
