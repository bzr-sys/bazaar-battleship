<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import type { DeepPartial } from "@bzr/bazaar";

import { useBazaarStore } from "@/stores/bazaar";
import type { HostedGame } from "@/types";
import { SIZE, allSunk, gridFromCells, isShot, pad2 } from "@/game";
import FleetSetup from "@/components/FleetSetup.vue";
import BattleStation from "@/components/BattleStation.vue";

const store = useBazaarStore();
const route = useRoute();

const gameId = computed(() => String(route.params.gameId));
const engagement = computed(() => store.engagements.find((e) => e.id === gameId.value));
const opponent = computed(() => (engagement.value ? store.people[engagement.value.opponentId] : undefined));
const opponentName = computed(() => opponent.value?.name || "Opponent");

// A game created a moment ago may not have reached the lobby list yet.
const searching = ref(true);
const searchTimer = setTimeout(() => (searching.value = false), 4000);
onUnmounted(() => clearTimeout(searchTimer));

const busy = ref(false);
const pending = ref<number | null>(null);
const error = ref("");

// A pending shot is done once it shows up in the game.
watch(
  () => engagement.value?.view?.myShots,
  (shots) => {
    if (pending.value !== null && shots && isShot(shots, pending.value)) pending.value = null;
  },
);

async function write(update: DeepPartial<HostedGame>) {
  const e = engagement.value;
  if (!e) return;
  error.value = "";
  await store.updateGame(e, { ...update, lastActive: "$now" });
}

async function lockFleet(fleet: number[][]) {
  const e = engagement.value;
  if (!e || busy.value) return;
  busy.value = true;
  const ships = gridFromCells(fleet.flat());
  try {
    await write(
      e.isHost
        ? { config: { hostUnset: [], hostShips: ships, hostFleet: fleet }, status: { hostSetup: true } }
        : { config: { guestUnset: [], guestShips: ships, guestFleet: fleet }, status: { guestSetup: true } },
    );
  } catch (err) {
    console.log(err);
    error.value = "Could not lock in your fleet. Check your connection and try again.";
  } finally {
    busy.value = false;
  }
}

async function fire(i: number) {
  const e = engagement.value;
  const v = e?.view;
  if (!e || !e.game || !v || e.phase !== "salvo" || pending.value !== null || isShot(v.myShots, i)) return;
  pending.value = i;
  const shots = v.myShots.map((row) => [...row]);
  shots[Math.floor(i / SIZE)][i % SIZE] = true;
  const log = [...v.myLog, i];
  const finished = allSunk(v.theirShips, shots);
  const status = { currentTurn: e.opponentId, finished };
  try {
    if (e.isHost) {
      await write({
        config: { hostBombs: shots, hostShotLog: log },
        status,
        ...(finished ? { highscore: { host: e.game.highscore.host + 1 } } : {}),
      });
    } else {
      await write({
        config: { guestBombs: shots, guestShotLog: log },
        status,
        ...(finished ? { highscore: { guest: e.game.highscore.guest + 1 } } : {}),
      });
    }
  } catch (err) {
    console.log(err);
    pending.value = null;
    error.value = "That shot did not go through. Try again.";
  }
}

async function rematch() {
  const e = engagement.value;
  if (!e || busy.value) return;
  busy.value = true;
  try {
    await store.rematch(e);
  } catch (err) {
    console.log(err);
    error.value = "Could not start a new game. Try again.";
  } finally {
    busy.value = false;
  }
}

// Each game of a series gets a fresh setup screen.
const round = computed(() => {
  const v = engagement.value?.view;
  return v ? v.myScore + v.theirScore + (v.finished ? 0 : 1) : 1;
});
</script>

<template>
  <div>
    <div class="border-b border-sonar-line bg-sonar-panel">
      <div class="mx-auto flex min-h-[56px] max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5 sm:px-6">
        <RouterLink
          :to="{ name: 'home' }"
          class="inline-flex min-h-[44px] items-center gap-1.5 tracking-[0.1em] text-sonar-cyan no-underline hover:text-sonar-cyan-hi"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6"></path>
          </svg>
          ENGAGEMENTS
        </RouterLink>
        <template v-if="engagement">
          <span class="hd text-lg text-sonar-bright">vs {{ opponentName }}</span>
          <span class="text-sonar-dim">
            <template v-if="opponent?.handle">@{{ opponent.handle }} · </template>engagement {{ round }}
          </span>
          <span
            v-if="engagement.phase === 'deploy'"
            class="ml-auto inline-flex items-center gap-2"
            :class="engagement.view?.opponentSetup ? 'text-sonar-cyan' : 'text-sonar-muted'"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="engagement.view?.opponentSetup ? 'bg-sonar-cyan shadow-[0_0_8px_#46E3D2]' : 'bg-sonar-edge'"
            ></span>
            {{ engagement.view?.opponentSetup ? "ENEMY FLEET DEPLOYED" : "ENEMY DEPLOYING" }}
          </span>
          <span
            v-else-if="engagement.view"
            class="ml-auto inline-flex items-baseline gap-2.5"
            :aria-label="`Series score: you ${engagement.view.myScore}, ${opponentName} ${engagement.view.theirScore}`"
          >
            <span class="label">Series</span>
            <span class="hd text-[22px] text-sonar-bright">
              {{ pad2(engagement.view.myScore) }}–{{ pad2(engagement.view.theirScore) }}
            </span>
          </span>
        </template>
      </div>
    </div>

    <main class="mx-auto max-w-[1240px] px-4 pb-12 pt-6 sm:px-6">
      <p v-if="error" role="alert" class="mb-4 mt-0 border border-sonar-flare px-4 py-3 text-sonar-flare-text">
        {{ error }}
      </p>

      <section v-if="!engagement" class="panel mx-auto max-w-[560px]" role="status">
        <template v-if="searching">
          <h1 class="hd m-0 text-xl text-sonar-bright">Locating engagement…</h1>
        </template>
        <template v-else>
          <h1 class="hd m-0 text-xl text-sonar-bright">Engagement not found</h1>
          <p class="mb-4 text-sonar-muted">This game is hidden, was removed, or belongs to another account.</p>
          <RouterLink :to="{ name: 'home' }" class="btn-outline">Back to engagements</RouterLink>
        </template>
      </section>

      <section v-else-if="engagement.game === null" class="panel mx-auto max-w-[560px]">
        <h1 class="hd m-0 text-xl text-sonar-bright">Game unavailable</h1>
        <p class="mb-4 text-sonar-muted">{{ opponentName }} removed this game, or it is no longer shared with you.</p>
        <RouterLink :to="{ name: 'home' }" class="btn-outline">Back to engagements</RouterLink>
      </section>

      <section v-else-if="!engagement.view || !engagement.phase" class="panel mx-auto max-w-[560px]" role="status">
        <h1 class="hd m-0 text-xl text-sonar-bright">Establishing contact…</h1>
      </section>

      <FleetSetup
        v-else-if="engagement.phase === 'deploy'"
        :key="`setup-${round}`"
        :opponent-name="opponentName"
        :opponent-ready="engagement.view.opponentSetup"
        :busy="busy"
        @lock="lockFleet"
      />

      <BattleStation
        v-else
        :view="engagement.view"
        :phase="engagement.phase"
        :opponent-name="opponentName"
        :pending="pending"
        :busy="busy"
        @fire="fire"
        @rematch="rematch"
      />
    </main>
  </div>
</template>
