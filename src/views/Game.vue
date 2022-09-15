<template>
  <div class="game">
    <div class="game-card">
      <p class="game-card-title">High Score</p>
      <p v-if="isHost">You ({{ game.highscore.host }}) - Opponent ({{ game.highscore.guest }})</p>
      <p v-else>You ({{ game.highscore.guest }}) - Opponent ({{ game.highscore.host }})</p>
    </div>

    <!-- <p>Host: {{ game.host }} <span v-if="isHost">(you)</span></p>
    <p>Guest: {{ game.guest.id }} <span v-if="!isHost">(you)</span></p>
    <p>Turn: {{ game.status.currentTurn }}</p>
    <p>Finished: {{ game.status.finished }}</p> -->

    <div class="game-card">
      <p class="game-card-title">Status</p>
      <p v-if="!setupComplete">Set up your ships</p>
      <p v-else-if="!opponentSetupComplete">Wait for opponent to set up ships</p>
      <p v-else-if="game.status.finished">Game is finished</p>
      <p v-else-if="myTurn">It is your turn</p>
      <p v-else>Wait for opponent to play</p>
    </div>

    <button v-if="game.status.finished" class="game-button" @click="startNewGame()">Start new game</button>

    <div v-if="setupComplete" class="game-board">
      <div class="flex">
        <div>
          <p class="game-card-title">You ships</p>
          <div class="board">
            <div v-for="(row, ri) in shipBoard" :key="ri" class="row">
              <div v-for="(col, ci) in row" :key="ci" class="col" :class="'ship-' + col"></div>
            </div>
          </div>
        </div>

        <div v-if="opponentSetupComplete">
          <p class="game-card-title">Your bombs</p>
          <div class="board">
            <div v-for="(row, ri) in bombBoard" :key="ri" class="row">
              <button
                v-for="(col, ci) in row"
                :key="ci"
                class="col"
                :class="'bomb-' + col"
                :disabled="disabledBomb(ri, ci)"
                @click="setBomb(ri, ci)"
              ></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="game-board">
      <!-- Set up ships-->
      <div v-if="unsetShips.length > 0" class="button-group">
        <p>Choose a ship to place on board</p>
        <button
          v-for="s in unsetShips"
          :key="s"
          class="game-button"
          :class="unsetShipClass(s)"
          @click="selectUnsetShip(s)"
        >
          {{ s }}
        </button>
        <p>Right click to rotate ship</p>
      </div>
      <div v-else class="button-group">
        <button class="game-button" @click="completeSetup()">Start</button>
      </div>

      <div class="board" @mouseleave="mouseleaveBoard()">
        <div v-for="(row, ri) in placementBoard" :key="ri" class="row">
          <div
            v-for="(col, ci) in row"
            :key="ci"
            class="col"
            :class="'setup-' + col"
            @mouseover="mouseoverField(ri, ci)"
            @click="setShip()"
            @contextmenu="flipOrientation($event)"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ComputedRef, ref } from "vue";
import { useStore } from "vuex";
import { useRoute, useRouter } from "vue-router";
import useRouterParams from "@/composables/router-params";
import { Game } from "@/types";

import { rid } from "@/rethinkid";
import { MessageOrError, SubscribeListener } from "@mostlytyped/rethinkid-js-sdk/dist/types/types";

export default defineComponent({
  name: "Game",
  setup() {
    const store = useStore();
    const route = useRoute();
    const router = useRouter();
    const { getStringFromParam } = useRouterParams;

    const userId = computed(() => store.state.user.id);
    const hostId = ref(getStringFromParam(route.params.hostId));
    const guestId = ref(getStringFromParam(route.params.guestId));
    const isHost = userId.value == hostId.value;

    // TODO should be defined somewhere common and imported
    const HOSTED_GAMES_TABLE_NAME = "hosted_games";
    const INVITED_GAMES_TABLE_NAME = "invited_games";
    const allShips = ["carrier", "battleship", "destroyer", "submarine", "patrol_boat"];
    const allFalse = Array(10).fill(Array(10).fill(false));
    const shipSizeMap = {
      carrier: 5,
      battleship: 4,
      destroyer: 3,
      submarine: 3,
      patrol_boat: 2,
    } as any;

    // TODO RETHINKID: opponents data is "visible" which might be exposed by portability.
    const game = ref({
      id: "",
      host: "", // TODO not needed
      guest: {
        id: "",
        email: "",
        name: "",
      },
      config: {
        hostUnset: allShips,
        guestUnset: allShips,
        hostShips: allFalse,
        guestShips: allFalse,
        hostBombs: allFalse,
        guestBombs: allFalse,
      },
      highscore: {
        host: 0,
        guest: 0,
      },
      status: {
        hostOnline: 0,
        guestOnline: 0,
        currentTurn: "",
        hostSetup: false,
        guestSetup: false,
        finished: false,
      },
    } as Game);

    const selectedShip = ref("");
    const shipOrientation = ref("v" as "v" | "h");
    const currentRow = ref(-1);
    const currentCol = ref(-1);

    let unsubscribe: (() => Promise<MessageOrError>) | undefined;

    const updateGame: SubscribeListener = (changes) => {
      const old_game = changes.old_val as Game;
      const new_game = changes.new_val as Game;
      game.value = new_game;

      if (old_game.status.finished && !new_game.status.finished && unsubscribe != undefined) {
        // New game started -> cancel subscription
        unsubscribe().then(() => {
          unsubscribe = undefined;
        });
      }
    };

    // Get game
    rid.tableRead(HOSTED_GAMES_TABLE_NAME, { rowId: guestId.value, userId: hostId.value }).then((g: any) => {
      // TODO define any
      if (g.error) {
        console.log("Got error instead of game:", g.error);
      }
      game.value = g.data as Game;

      // Subscribe to more if setup complete
      if ((isHost && game.value.status.hostSetup) || (!isHost && game.value.status.guestSetup)) {
        rid
          .tableSubscribe(HOSTED_GAMES_TABLE_NAME, { rowId: guestId.value, userId: hostId.value }, updateGame)
          .then((u) => {
            unsubscribe = u;
          });
      }
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

      let placements = {} as any;
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
      return game.value.status.currentTurn == userId.value;
    });

    const unsetShipClass: (ship: string) => string = (ship) => {
      if (ship == selectedShip.value) {
        return "selected";
      }
      return "";
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
      // console.log("Row: -1 Col: -1");
    };

    const flipOrientation: (e: any) => void = (e) => {
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

      if (isHost) {
        if (shipOrientation.value == "v") {
          if (r > 10 - size) {
            return;
          }
          for (let i = 0; i < size; i++) {
            if (game.value.config.hostShips[r + i][c]) {
              // check for collision
              return;
            }
          }
          for (let i = 0; i < size; i++) {
            game.value.config.hostShips[r + i][c] = true;
          }
        } else {
          // orientation is "h"
          if (c > 10 - size) {
            return;
          }
          for (let i = 0; i < size; i++) {
            // check for collision
            if (game.value.config.hostShips[r][c + i]) {
              return;
            }
          }
          for (let i = 0; i < size; i++) {
            game.value.config.hostShips[r][c + i] = true;
          }
        }
        const index = game.value.config.hostUnset.indexOf(selectedShip.value);
        if (index > -1) {
          game.value.config.hostUnset.splice(index, 1);
        }
      } else {
        // guest
        if (shipOrientation.value == "v") {
          if (r > 10 - size) {
            return;
          }
          for (let i = 0; i < size; i++) {
            if (game.value.config.guestShips[r + i][c]) {
              // check for collision
              return;
            }
          }
          for (let i = 0; i < size; i++) {
            game.value.config.guestShips[r + i][c] = true;
          }
        } else {
          // orientation is "h"
          if (c > 10 - size) {
            return;
          }
          for (let i = 0; i < size; i++) {
            if (game.value.config.guestShips[r][c + i]) {
              // check for collision
              return;
            }
          }
          for (let i = 0; i < size; i++) {
            game.value.config.guestShips[r][c + i] = true;
          }
        }
        const index = game.value.config.guestUnset.indexOf(selectedShip.value);
        if (index > -1) {
          game.value.config.guestUnset.splice(index, 1);
        }
      }
      // unselect ship
      selectedShip.value = "";
    };

    const completeSetup: () => void = () => {
      if (isHost) {
        game.value.status.hostSetup = true;

        // Update config and status
        rid.tableUpdate(HOSTED_GAMES_TABLE_NAME, {
          id: guestId.value,
          config: {
            hostUnset: game.value.config.hostUnset,
            hostShips: game.value.config.hostShips,
          },
          status: {
            hostSetup: true,
          },
        });
      } else {
        // isGuest
        game.value.status.guestSetup = true;

        // Update config and status
        rid.tableUpdate(
          HOSTED_GAMES_TABLE_NAME,
          {
            id: guestId.value,
            config: {
              guestUnset: game.value.config.guestUnset,
              guestShips: game.value.config.guestShips,
            },
            status: {
              guestSetup: true,
            },
          },
          { userId: hostId.value },
        );
      }

      rid
        .tableSubscribe(HOSTED_GAMES_TABLE_NAME, { rowId: guestId.value, userId: hostId.value }, updateGame)
        .then((u) => {
          unsubscribe = u;
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
        game.value.status.currentTurn = guestId.value;
        if (finishedGame(game.value.config.guestShips, game.value.config.hostBombs)) {
          game.value.status.finished = true;
          game.value.highscore.host += 1;
        }
      } else {
        game.value.config.guestBombs[ri][ci] = true;
        game.value.status.currentTurn = hostId.value;
        if (finishedGame(game.value.config.hostShips, game.value.config.guestBombs)) {
          game.value.status.finished = true;
          game.value.highscore.guest += 1;
        }
      }

      rid.tableUpdate(HOSTED_GAMES_TABLE_NAME, game.value, { userId: hostId.value });
    };

    const startNewGame: () => void = () => {
      const allShips = ["carrier", "battleship", "destroyer", "submarine", "patrol_boat"];
      const allFalse = Array(10).fill(Array(10).fill(false));
      game.value.config = {
        hostUnset: allShips,
        guestUnset: allShips,
        hostShips: allFalse,
        guestShips: allFalse,
        hostBombs: allFalse,
        guestBombs: allFalse,
      };
      game.value.status.hostSetup = false;
      game.value.status.guestSetup = false;
      game.value.status.finished = false;
      rid.tableUpdate(HOSTED_GAMES_TABLE_NAME, game.value, { userId: hostId.value });
    };

    return {
      game,
      isHost,
      placementBoard,
      shipBoard,
      bombBoard,
      unsetShips,
      setupComplete,
      opponentSetupComplete,
      myTurn,
      unsetShipClass,
      selectUnsetShip,
      mouseoverField,
      mouseleaveBoard,
      flipOrientation,
      setShip,
      completeSetup,
      disabledBomb,
      setBomb,
      startNewGame,
    };
  },
});
</script>

<style scoped lang="scss">
.game {
  max-width: min(1200px, 90%);
  margin-inline: auto;
  text-align: center;
}

.game-card {
  max-width: 400px;
  margin-inline: auto;
  text-align: center;

  padding: 1rem;
  margin-block: 1rem;

  display: flow-root; // make sure margin of children is respected
  background-color: hsl(189, 50%, 70%);
  border-radius: 0.25rem;
  box-shadow: 0 0.5rem 1em -0.125em rgb(10 10 10 / 10%), 0 0 0 1px rgb(10 10 10 / 2%);

  &-title {
    font-size: 0.9rem;
    font-weight: 600;
  }
}

.game-board {
  max-width: 800px;
  margin-inline: auto;
  text-align: center;

  padding: 1rem;
  margin-block: 1rem;

  display: flow-root; // make sure margin of children is respected
  background-color: hsl(189, 50%, 70%);
  border-radius: 0.25rem;
  box-shadow: 0 0.5rem 1em -0.125em rgb(10 10 10 / 10%), 0 0 0 1px rgb(10 10 10 / 2%);
}
.button-group {
  padding: 1rem;
}

.flex {
  display: flex;
  justify-content: center;
  gap: 1rem;
}
.board {
  // padding: 1em;
  display: inline-block;
}
.row {
  height: 30px;
  display: grid;
  grid-template-columns: 30px 30px 30px 30px 30px 30px 30px 30px 30px 30px;
}

.col {
  border-color: black;
  border-width: 1px;
  border-style: solid;
  // background-color: white;

  // &:hover {
  //   background-color: grey;
  // }
}

.game-button {
  // border-color: red;
  // border-width: 1px;
  border-style: none;
  padding: 1rem;
  background-color: hsl(189, 50%, 40%);
  margin: 3px;
}

.selected {
  background-color: grey;
}

.setup {
  &-0 {
    // Water
    background-color: white;
  }

  &-1 {
    // Ship
    background-color: black;
  }

  &-2 {
    // Possible
    background-color: grey;
  }

  &-3 {
    // Impossible
    background-color: red;
  }
}

.ship {
  &-0 {
    // Water
    background-color: white;
  }

  &-1 {
    // Ship
    background-color: black;
  }

  &-2 {
    // Ship (hit)
    background-color: red;
  }

  &-3 {
    // Ship
    background-color: blue;
  }
}

.bomb {
  &-0 {
    // Water
    background-color: white;
    &:hover {
      background-color: red;
    }

    &:disabled {
      background-color: whitesmoke;
      border-color: lightgrey;
    }
  }

  &-1 {
    // Miss
    background-color: lightgrey;
    border-color: lightgrey;
  }

  &-2 {
    // Hit
    background-color: black;
  }
}
</style>
