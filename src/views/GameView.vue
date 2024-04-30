<script setup lang="ts">
import { computed, ref } from "vue";
import type { ComputedRef, Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Game, InvitedGame, HostedGame } from "@/types";

import { bzr } from "@/bazaar";
import type { BazaarMessage, SubscribeListener } from "@bzr/bazaar";
import {
  useBazaarStore,
  HOSTED_GAME_TYPE,
  INVITED_GAME_TYPE,
  GAMES_COLLECTION_NAME,
  freshGameConfig,
} from "@/stores/bazaar";

const store = useBazaarStore();
const router = useRouter();
const route = useRoute();

const userId = store.user.id;
const gameId = Array.isArray(route.params.gameId) ? route.params.gameId[0] : route.params.gameId;

let gameIdx = store.visibleGames.findIndex((g) => {
  return g.id === gameId;
});

if (gameIdx < 0) {
  router.push({ name: "home" });
}

let hostId = userId;
let guestId = userId;
let realGameId = gameId;
let isHost = true;
if (store.visibleGames[gameIdx].type === INVITED_GAME_TYPE) {
  const g = store.visibleGames[gameIdx] as InvitedGame;
  hostId = g.hostId;
  realGameId = g.gameId;
  isHost = false;
} else {
  const g = store.visibleGames[gameIdx] as HostedGame;
  guestId = g.guestId;
}

const shipSizeMap = {
  carrier: 5,
  battleship: 4,
  destroyer: 3,
  submarine: 3,
  patrol_boat: 2,
} as { [key: string]: number };

const game: Ref<HostedGame> = ref({
  id: realGameId,
  visible: true,
  lastActive: new Date().toISOString(),

  type: HOSTED_GAME_TYPE,
  guestId: guestId,
  config: freshGameConfig(),
  highscore: {
    host: 0,
    guest: 0,
  },
  status: {
    currentTurn: "",
    hostSetup: false,
    guestSetup: false,
    finished: false,
  },
});

const selectedShip = ref("");
const shipOrientation = ref("v" as "v" | "h");
const currentRow = ref(-1);
const currentCol = ref(-1);

let unsubscribe: (() => Promise<BazaarMessage>) | undefined;

const updateGame: SubscribeListener<HostedGame> = (changes) => {
  const oldGame = changes.oldDoc;
  const newGame = changes.newDoc;
  if (!newGame) {
    return;
  }
  game.value = newGame;

  if (!oldGame) {
    return;
  }
  if (oldGame.status.finished && !newGame.status.finished && unsubscribe != undefined) {
    // New game started -> cancel subscription
    unsubscribe().then(() => {
      unsubscribe = undefined;
    });
  }
};

const gameCollection = bzr.collection<HostedGame>(GAMES_COLLECTION_NAME, { userId: hostId });

// Get game
gameCollection
  .getOne(realGameId)
  .then((g) => {
    if (!g) {
      console.log("failed game ID:", realGameId);
      console.log("failed game host:", hostId);
      return;
    }
    game.value = g;

    // Subscribe to more if setup complete
    if ((isHost && game.value.status.hostSetup) || (!isHost && game.value.status.guestSetup)) {
      gameCollection
        .subscribeOne(realGameId, updateGame)
        .then((u) => {
          unsubscribe = u;
        })
        .catch((err) => {
          console.log("Got error:", err);
        });
    }
  })
  .catch((err) => {
    console.log("Got error instead of game:", err);
  });

// 0: Empty
// 1: Ship
// 2: Ship placement (possible)
// 3: Ship placement (impossible)
const placementBoard: ComputedRef<number[][]> = computed(() => {
  const r = currentRow.value; // Assignment required for reactivity
  const c = currentCol.value; // Assignment required for reactivity
  let ships = game.value.config.guestShips;
  if (isHost) {
    ships = game.value.config.hostShips;
  }

  let placements = {} as { [key: number]: { [key: number]: number } };
  if (selectedShip.value != "") {
    let possible = 2;
    const size = shipSizeMap[selectedShip.value];
    if (shipOrientation.value == "v") {
      if (r > 10 - size) {
        possible = 3;
      }
      for (let i = 0; i < size; i++) {
        placements[r + i] = {};
        placements[r + i][c] = possible;
      }
    } else {
      if (c > 10 - size) {
        possible = 3;
      }
      placements[r] = {};
      for (let i = 0; i < size; i++) {
        placements[r][c + i] = possible;
      }
    }
  }

  return ships.map((row: boolean[], ri: number) => {
    return row.map((col, ci) => {
      if (col) {
        if (placements[ri] && placements[ri][ci]) {
          return 3;
        }
        return 1;
      } else {
        if (placements[ri] && placements[ri][ci]) {
          return placements[ri][ci];
        }
        return 0;
      }
    });
  });
});

// 0: Empty
// 1: Ship (unhit)
// 2: Ship (hit)
// 3: Bomb
const shipBoard: ComputedRef<number[][]> = computed(() => {
  let ships = game.value.config.guestShips;
  let bombs = game.value.config.hostBombs;
  if (isHost) {
    ships = game.value.config.hostShips;
    bombs = game.value.config.guestBombs;
  }

  return ships.map((row: boolean[], ri: number) => {
    return row.map((col, ci) => {
      if (col) {
        if (bombs[ri][ci]) {
          return 2;
        }
        return 1;
      } else {
        if (bombs[ri][ci]) {
          return 3;
        }
        return 0;
      }
    });
  });
});

// 0: Empty
// 1: Bomb (no hit)
// 2: Bomb (hit)
const bombBoard: ComputedRef<number[][]> = computed(() => {
  let ships = game.value.config.hostShips;
  let bombs = game.value.config.guestBombs;
  if (isHost) {
    ships = game.value.config.guestShips;
    bombs = game.value.config.hostBombs;
  }
  return bombs.map((row: boolean[], ri: number) => {
    return row.map((col, ci) => {
      if (col) {
        if (ships[ri][ci]) {
          return 2;
        }
        return 1;
      } else {
        return 0;
      }
    });
  });
});

const unsetShips: ComputedRef<string[]> = computed(() => {
  if (isHost) {
    return game.value.config.hostUnset;
  }
  return game.value.config.guestUnset;
});

const setupComplete: ComputedRef<boolean> = computed(() => {
  if (isHost) {
    return game.value.status.hostSetup;
  }
  return game.value.status.guestSetup;
});

const opponentSetupComplete: ComputedRef<boolean> = computed(() => {
  if (isHost) {
    return game.value.status.guestSetup;
  }
  return game.value.status.hostSetup;
});

const myTurn: ComputedRef<boolean> = computed(() => {
  return game.value.status.currentTurn == userId;
});

const unsetShipClass: (ship: string) => string = (ship) => {
  if (ship == selectedShip.value) {
    return "border-amber-700 bg-amber-700";
  }
  return "border-amber-500 bg-amber-500";
};

const selectUnsetShip: (ship: string) => void = (ship) => {
  selectedShip.value = ship;
};

const mouseoverField: (ri: number, ci: number) => void = (ri, ci) => {
  currentRow.value = ri;
  currentCol.value = ci;
};

const mouseleaveBoard: () => void = () => {
  currentRow.value = -1;
  currentCol.value = -1;
};

const flipOrientation: (e: Event) => void = (e) => {
  if (shipOrientation.value == "v") {
    shipOrientation.value = "h";
  } else {
    shipOrientation.value = "v";
  }
  e.preventDefault();
};

const setShip: () => void = () => {
  if (selectedShip.value == "") {
    return;
  }
  const r = currentRow.value;
  const c = currentCol.value;
  const size = shipSizeMap[selectedShip.value];

  let unset = game.value.config.guestUnset;
  let ships = game.value.config.guestShips;
  if (isHost) {
    unset = game.value.config.hostUnset;
    ships = game.value.config.hostShips;
  }
  if (shipOrientation.value == "v") {
    if (r > 10 - size) {
      return;
    }
    for (let i = 0; i < size; i++) {
      if (ships[r + i][c]) {
        // check for collision
        return;
      }
    }
    for (let i = 0; i < size; i++) {
      ships[r + i][c] = true;
    }
  } else {
    // orientation is "h"
    if (c > 10 - size) {
      return;
    }
    for (let i = 0; i < size; i++) {
      // check for collision
      if (ships[r][c + i]) {
        return;
      }
    }
    for (let i = 0; i < size; i++) {
      ships[r][c + i] = true;
    }
  }
  const index = unset.indexOf(selectedShip.value);
  if (index > -1) {
    unset.splice(index, 1);
  }

  if (isHost) {
    game.value.config.hostShips = ships;
    game.value.config.hostUnset = unset;
  } else {
    game.value.config.guestShips = ships;
    game.value.config.guestUnset = unset;
  }
  // unselect ship
  selectedShip.value = "";
};

// Must satisfy DeepPartial<HostedGame>
type GameSetup =
  | {
      status: { guestSetup: true };
      config: { guestUnset: string[]; guestShips: boolean[][] };
    }
  | {
      status: { hostSetup: true };
      config: { hostUnset: string[]; hostShips: boolean[][] };
    };

const completeSetup: () => void = () => {
  let gameUpdate = {} as GameSetup;

  if (isHost) {
    gameUpdate["config"] = {
      hostUnset: game.value.config.hostUnset,
      hostShips: game.value.config.hostShips,
    };
    gameUpdate["status"] = { hostSetup: true };
  } else {
    // isGuest
    gameUpdate["config"] = {
      guestUnset: game.value.config.guestUnset,
      guestShips: game.value.config.guestShips,
    };
    gameUpdate["status"] = { guestSetup: true };
  }

  // Update config and status
  gameCollection
    // @ts-ignore TODO should no longer be required with bazaar v1.1.1
    .updateOne(realGameId, gameUpdate)
    .then(() => {
      gameCollection
        .subscribeOne(realGameId, updateGame)
        .then((u) => {
          unsubscribe = u;

          // Update current game since other player might also have completed setup
          gameCollection
            .getOne(realGameId)
            .then((g) => {
              game.value = g;
            })
            .catch((err) => {
              console.log("Got error instead of game:", err);
            });
        })
        .catch((err) => {
          console.log("Got error:", err);
        });
    })
    .catch((err) => {
      console.log("Got error:", err);
    });
};

const disabledBomb: (ri: number, ci: number) => boolean = (ri, ci) => {
  if (!myTurn.value) {
    return true;
  }
  if (game.value.status.finished) {
    return true;
  }
  if (bombBoard.value[ri][ci] > 0) {
    return true;
  }
  return false;
};

const finishedGame: (ships: boolean[][], bombs: boolean[][]) => boolean = (ships, bombs) => {
  for (const ri in ships) {
    for (const ci in ships[ri]) {
      if (ships[ri][ci] && !bombs[ri][ci]) {
        return false;
      }
    }
  }
  return true;
};

const setBomb: (ri: number, ci: number) => void = (ri, ci) => {
  if (disabledBomb(ri, ci)) {
    // Sanity check
    return;
  }
  if (isHost) {
    game.value.config.hostBombs[ri][ci] = true;
    game.value.status.currentTurn = guestId;
    if (finishedGame(game.value.config.guestShips, game.value.config.hostBombs)) {
      game.value.status.finished = true;
      game.value.highscore.host += 1;
    }
  } else {
    game.value.config.guestBombs[ri][ci] = true;
    game.value.status.currentTurn = hostId;
    if (finishedGame(game.value.config.hostShips, game.value.config.guestBombs)) {
      game.value.status.finished = true;
      game.value.highscore.guest += 1;
    }
  }

  gameCollection.updateOne(game.value.id, game.value).catch((err) => {
    console.log("Got error:", err);
  });
};

const startNewGame: () => void = () => {
  game.value.config = freshGameConfig();
  game.value.status.hostSetup = false;
  game.value.status.guestSetup = false;
  game.value.status.finished = false;
  gameCollection.updateOne(game.value.id, game.value).catch((err) => {
    console.log("Got error:", err);
  });
};
</script>

<template>
  <div class="max-w-5xl mx-auto text-center bg-neutral-400">
    <div class="pt-4">
      <div class="max-w-sm mx-auto p-4 bg-neutral-700 text-white">
        <p class="font-semibold">High Score</p>
        <p v-if="isHost">You ({{ game.highscore.host }}) - Opponent ({{ game.highscore.guest }})</p>
        <p v-else>You ({{ game.highscore.guest }}) - Opponent ({{ game.highscore.host }})</p>
      </div>
    </div>

    <!-- <p>Host: {{ game.host }} <span v-if="isHost">(you)</span></p>
    <p>Guest: {{ game.guest.id }} <span v-if="!isHost">(you)</span></p>
    <p>Turn: {{ game.status.currentTurn }}</p>
    <p>Finished: {{ game.status.finished }}</p> -->
    <div class="pt-4">
      <div class="max-w-sm mx-auto p-4 bg-neutral-700 text-white">
        <p class="font-semibold">Status</p>
        <p v-if="!setupComplete">Set up your ships</p>
        <p v-else-if="!opponentSetupComplete">Wait for opponent to set up ships</p>
        <p v-else-if="game.status.finished">Game is finished</p>
        <p v-else-if="myTurn">It is your turn</p>
        <p v-else>Wait for opponent to play</p>
      </div>
    </div>

    <div v-if="game.status.finished" class="pt-4">
      <button class="border-2 border-amber-500 bg-amber-500 px-4 py-2 text-white font-semibold" @click="startNewGame()">
        Start new game
      </button>
    </div>

    <div class="py-4 text-white">
      <div v-if="setupComplete" class="max-w-3xl mx-auto p-4 bg-neutral-700">
        <div class="flex justify-center gap-4 flex-col md:flex-row">
          <div>
            <p class="font-semibold">Your ships</p>
            <div class="inline-block border-2 border-amber-500">
              <div v-for="(row, ri) in shipBoard" :key="ri" class="row">
                <div v-for="(col, ci) in row" :key="ci" class="border-neutral-900 border" :class="'ship-' + col"></div>
              </div>
            </div>
          </div>

          <div v-if="opponentSetupComplete">
            <p class="font-semibold">Your bombs</p>
            <div class="inline-block border-2 border-amber-500">
              <div v-for="(row, ri) in bombBoard" :key="ri" class="row">
                <button
                  v-for="(col, ci) in row"
                  :key="ci"
                  class="border-neutral-900 border"
                  :class="'bomb-' + col"
                  :disabled="disabledBomb(ri, ci)"
                  @click="setBomb(ri, ci)"
                ></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="max-w-3xl mx-auto p-4 bg-neutral-700 text-white">
        <!-- Set up ships-->
        <div v-if="unsetShips.length > 0" class="py-4">
          <p>Choose a ship to place on board</p>
          <button
            v-for="s in unsetShips"
            :key="s"
            class="border-2 px-4 py-2 text-white font-semibold m-2"
            :class="unsetShipClass(s)"
            @click="selectUnsetShip(s)"
          >
            {{ s }}
          </button>
          <p>Right click to rotate ship</p>
        </div>
        <div v-else class="py-4">
          <button
            class="border-2 border-amber-500 bg-amber-500 px-4 py-2 text-white font-semibold"
            @click="completeSetup()"
          >
            Start
          </button>
        </div>

        <div class="inline-block border-2 border-amber-500" @mouseleave="mouseleaveBoard()">
          <div v-for="(row, ri) in placementBoard" :key="ri" class="row">
            <div
              v-for="(col, ci) in row"
              :key="ci"
              class="border-neutral-900 border"
              :class="'setup-' + col"
              @mouseover="mouseoverField(ri, ci)"
              @click="setShip()"
              @contextmenu="flipOrientation($event)"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.row {
  height: 30px;
  display: grid;
  grid-template-columns: 30px 30px 30px 30px 30px 30px 30px 30px 30px 30px;
}

.setup {
  &-0 {
    // Water
    background-color: white;
  }

  &-1 {
    // Ship
    @apply bg-neutral-900;
  }

  &-2 {
    // Possible
    @apply bg-neutral-400;
  }

  &-3 {
    // Impossible
    @apply bg-red-600;
  }
}

.ship {
  &-0 {
    // Water
    background-color: white;
  }

  &-1 {
    // Ship
    @apply bg-neutral-900;
  }

  &-2 {
    // Ship (hit)
    @apply bg-red-600;
  }

  &-3 {
    // Water (hit)
    @apply bg-blue-700;
  }
}

.bomb {
  &-0 {
    // Water
    background-color: white;
    &:hover {
      @apply bg-red-600;
    }

    &:disabled {
      @apply bg-neutral-100;
      @apply border-neutral-300;
    }
  }

  &-1 {
    // Miss
    @apply bg-neutral-300;
    @apply border-neutral-300;
  }

  &-2 {
    // Hit
    @apply bg-neutral-900;
  }
}
</style>
