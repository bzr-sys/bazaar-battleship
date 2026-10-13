<script setup lang="ts">
import { useBazaarStore } from "@/stores/bazaar";
import { bzr } from "@/bazaar";

const store = useBazaarStore();
</script>

<template>
  <header class="border-b border-sonar-line bg-sonar-deep">
    <div class="mx-auto flex min-h-[60px] max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 sm:px-6">
      <RouterLink :to="{ name: 'home' }" class="hd text-xl text-sonar-bright no-underline hover:text-sonar-cyan-hi">
        Battleship
      </RouterLink>
      <span class="label hidden sm:inline">Bazaar · fleet command</span>
      <div class="ml-auto flex items-center gap-4">
        <template v-if="store.authenticated">
          <span class="hidden text-[13px] sm:inline">
            <span class="text-sonar-dim">OPERATOR</span> {{ store.user.name }}
            <span class="text-sonar-dim">@{{ store.user.handle }}</span>
          </span>
          <button class="btn-outline min-h-[36px]" @click="bzr.logOut()">Log out</button>
        </template>
        <button v-else class="btn-primary min-h-[36px]" @click="bzr.login()">Sign up or Log in</button>
      </div>
    </div>
  </header>
</template>
