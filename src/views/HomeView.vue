<template>
  <main>
    <div class="pt-4">
      <div v-if="!store.authenticated">
        <button @click="login" class="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">
          Sign in with Bazaar
        </button>
      </div>

      <template v-else>
        <div class="">
          <div>
            <GameCreate />
          </div>
          <div class="bg-indigo-100 p-4">
            <h2 class="text-2xl">Games</h2>
            <div class="grid gap-2">
              <div v-for="game in visibleGames" :key="game.id" class="flex justify-between">
                <div class="border-2 border-indigo-500 rounded basis-full">
                  <div v-if="game.type === HOSTED_GAME_TYPE" class="p-4" role="button" @click="goToGame(game.id)">
                    <span class="font-bold"
                      >{{ game.name }} ({{ game.highscore.guest }} - {{ game.highscore.host }})
                    </span>
                  </div>

                  <div v-else-if="game.type === INVITED_GAME_TYPE" class="p-4" role="button" @click="goToGame(game.id)">
                    <span class="font-bold">{{ game.name }}</span>
                  </div>

                  <div v-else-if="game.type === LINK_GAME_TYPE" class="flex gap-2 place-items-center p-4">
                    <span class="font-bold">{{ game.linkUrl }}</span>
                    <button class="bg-indigo-700 text-white px-2 py-1 rounded" @click="copy(game.linkUrl)">Copy</button>
                  </div>
                </div>
                <div class="border-2 border-indigo-500 rounded p-4">
                  <button class="bg-indigo-700 text-white px-2 py-1 rounded" @click="store.hideGame(game.id)">
                    Hide
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";

import { useBazaarStore, HOSTED_GAME_TYPE, INVITED_GAME_TYPE, LINK_GAME_TYPE } from "@/stores/bazaar";
import { bzr } from "@/bazaar";
import GameCreate from "@/components/GameCreate.vue";
const store = useBazaarStore();

const router = useRouter();
const route = useRoute();

const visibleGames = computed(() => store.visibleGames);
console.log(visibleGames.value);

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
</script>
