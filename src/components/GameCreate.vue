<script setup lang="ts">
import { useBazaarStore } from "@/stores/bazaar";
import { bzr } from "@/bazaar";

const store = useBazaarStore();
</script>

<template>
  <div class="bg-neutral-700 text-white p-4">
    <h2 class="text-2xl pb-2">Create New Game</h2>

    <div class="flex gap-2">
      <button
        class="border-2 border-amber-500 bg-amber-500 px-4 py-2 text-white font-semibold"
        @click="bzr.social.openModal(store.createGame)"
      >
        Find User
      </button>

      <button
        class="border-2 border-amber-500 bg-amber-500 px-4 py-2 text-white font-semibold"
        @click="store.createLink()"
      >
        Create Link
      </button>
    </div>
  </div>
</template>
