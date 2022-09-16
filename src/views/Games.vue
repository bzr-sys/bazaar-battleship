<template>
  <div class="board">
    <div v-if="!authenticated">
      <button @click="login" class="button is-primary">Sign in or create an account</button>
    </div>
    <template v-else>
      <div class="columns-grid" aria-live="polite">
        <GameCreate />
        <div>
          <h2 class="title">Hosted Games</h2>
          <div
            v-for="game in hostedGames"
            :key="game.id"
            class="card is-clickable"
            role="button"
            @click="goToGame(userId, game.guest.id)"
          >
            <div class="card-content">
              <h2 class="title is-4">{{ game.guest.id }}</h2>
            </div>
          </div>
        </div>
        <div>
          <h2 class="title">Invited Games</h2>
          <div
            v-for="game in invitedGames"
            :key="game.id"
            class="card is-clickable"
            role="button"
            @click="goToGame(game.id, userId)"
          >
            <div class="card-content">
              <h2 class="title is-4">{{ game.id }}</h2>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import GameCreate from "@/components/GameCreate.vue";
import { rid } from "@/rethinkid";

export default defineComponent({
  name: "Games",
  components: {
    GameCreate,
  },
  setup() {
    const store = useStore();
    const router = useRouter();

    const authenticated = computed(() => store.state.authenticated);
    const hostedGames = computed(() => store.state.hostedGames);
    const invitedGames = computed(() => store.state.invitedGames);
    const userId = computed(() => store.state.user.id);

    function login(): void {
      rid.login();
    }

    function goToGame(hostId: string, guestId: string): void {
      router.push({ name: "game", params: { hostId, guestId } });
    }

    return { authenticated, hostedGames, invitedGames, userId, goToGame, login };
  },
});
</script>

<style scoped lang="scss">
.board {
  padding: 1em;
}

.columns-grid {
  display: grid;
  gap: 1em;
  grid-template-columns: repeat(auto-fill, minmax(272px, 1fr));
  grid-auto-flow: column;
  grid-auto-columns: minmax(272px, 1fr);
  overflow-x: auto;
}
</style>
