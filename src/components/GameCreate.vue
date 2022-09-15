<template>
  <form @submit.prevent="submitCreateGame">
    <h2 class="title">New Game</h2>
    <div class="field mt-4">
      <label class="label is-sr-only" for="add-board-input">User ID</label>
      <div class="control mb-0">
        <input
          id="add-board-input"
          type="text"
          v-model="userId"
          class="input"
          placeholder="User ID"
          required
          autocomplete="off"
        />
      </div>
    </div>
    <button class="button" type="submit">Create game</button>
  </form>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "GameCreate",
  data() {
    return {
      userId: "",
    };
  },
  methods: {
    async submitCreateGame(): Promise<void> {
      await this.$store.dispatch("createGame", this.userId);
      this.userId = "";
    },
  },
});
</script>

<style scoped lang="scss"></style>
