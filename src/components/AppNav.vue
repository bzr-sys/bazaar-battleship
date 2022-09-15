<template>
  <nav class="navbar mb-4" role="navigation" aria-label="main navigation">
    <div class="navbar-brand">
      <router-link class="navbar-item" :to="{ name: 'home' }"> Battleship </router-link>
      <a role="button" class="navbar-burger" aria-label="menu" aria-expanded="false" data-target="nav">
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </a>
    </div>

    <div id="nav" class="navbar-menu">
      <div class="navbar-start"></div>

      <div class="navbar-end">
        <div class="navbar-item">
          <div class="buttons">
            <template v-if="authenticated">
              <div class="button">{{ user.email }}</div>
              <button class="button" @click="signOut">Sign out</button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { useStore } from "vuex";
import { rid } from "@/rethinkid";

export default defineComponent({
  name: "AppNav",
  setup() {
    const store = useStore();

    const authenticated = computed(() => store.state.authenticated);
    const user = computed(() => store.state.user);

    function signOut(): void {
      rid.logOut();
    }

    return { authenticated, user, signOut };
  },
});
</script>

<style scoped lang="scss"></style>
