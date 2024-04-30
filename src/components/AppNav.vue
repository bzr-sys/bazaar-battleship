<script setup lang="ts">
import { useBazaarStore } from "@/stores/bazaar";
import { bzr } from "@/bazaar";

const store = useBazaarStore();
</script>

<template>
  <header class="bg-neutral-700 py-4 text-white">
    <div class="flex place-content-between px-5">
      <RouterLink class="py-2 text-xl font-bold w-1/3" :to="{ name: 'home' }"> Bazaar Battleship </RouterLink>
      <div v-if="store.user.id" class="text-center w-1/3">
        <p class="text-lg">{{ store.user.name }}</p>
        <p class="text-xs">@{{ store.user.handle }}</p>
      </div>
      <div class="w-1/3 text-right">
        <button v-if="store.authenticated" class="border-2 border-amber-500 px-4 py-2" @click="bzr.logOut()">
          Logout
        </button>
        <button v-else class="border-2 border-amber-500 bg-amber-500 px-4 py-2" @click="bzr.login()">Login</button>
      </div>
    </div>
  </header>
</template>
