<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";

import { useBazaarStore, HOSTED_GAME_TYPE, INVITED_GAME_TYPE, LINK_GAME_TYPE } from "@/stores/bazaar";
import { bzr } from "@/bazaar";
import GameCreate from "@/components/GameCreate.vue";
const store = useBazaarStore();

const router = useRouter();
const route = useRoute();

async function login(): Promise<void> {
  try {
    await bzr.login();
    if (route.redirectedFrom && route.redirectedFrom.name) {
      router.push({ name: route.redirectedFrom.name });
    }
  } catch (e: unknown) {
    console.log("TODO: display login error");
  }
}

function goToGame(gameId: string): void {
  router.push({ name: "game", params: { gameId } });
}

function copy(link: string) {
  navigator.clipboard.writeText(link);
}

console.log(store.visibleGames);
</script>

<template>
  <main class="pt-4">
    <div v-if="!store.authenticated" class="text-center">
      <h1 class="text-lg py-3">Welcome to Bazaar Battleship</h1>
      <button @click="login()" class="border-2 border-amber-500 bg-amber-500 px-4 py-2 text-white font-semibold">
        Sign up or Log in
      </button>
    </div>

    <div v-else>
      <div class="pb-2">
        <GameCreate />
      </div>
      <div class="bg-neutral-400 p-4 text-white">
        <h2 class="text-2xl pb-2">Games</h2>
        <div class="grid gap-2">
          <div v-for="game in store.visibleGames" :key="game.id" class="flex justify-between bg-neutral-700">
            <div v-if="game.type === HOSTED_GAME_TYPE" class="p-4" role="button">
              <span class="font-bold pr-2"
                >{{ game.name }} ({{ game.highscore.guest }} - {{ game.highscore.host }})
              </span>
              <button
                class="border-2 border-amber-500 bg-amber-500 px-2 py-1 text-white font-semibold"
                @click="goToGame(game.id)"
              >
                Play
              </button>
            </div>

            <div v-else-if="game.type === INVITED_GAME_TYPE" class="p-4" role="button">
              <span class="font-bold pr-2">{{ game.name }}</span>
              <button
                class="border-2 border-amber-500 bg-amber-500 px-2 py-1 text-white font-semibold"
                @click="goToGame(game.id)"
              >
                Play
              </button>
            </div>

            <div v-else-if="game.type === LINK_GAME_TYPE" class="flex gap-2 place-items-center p-4">
              <span class="font-bold pr-2">{{ game.linkUrl }}</span>
              <button
                class="border-2 border-amber-500 bg-amber-500 px-2 py-1 text-white font-semibold"
                @click="copy(game.linkUrl)"
              >
                Copy
              </button>
            </div>

            <div class="p-4">
              <button
                class="border-2 border-amber-500 bg-neutral-700 px-2 py-1 text-white"
                @click="store.hideGame(game.id)"
              >
                Hide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
