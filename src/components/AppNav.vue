<template>
  <div class="py-4 bg-indigo-300 text-white">
    <nav class="flex gap-4" role="navigation" aria-label="main navigation">
      <div class="">
        <router-link class="" :to="{ name: 'home' }"> Battleship </router-link>
        <a role="button" class="" aria-label="menu" aria-expanded="false" data-target="nav">
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </a>
      </div>

      <div id="nav" class="flex justify-between w-full">
        <!-- Navbar start -->
        <div class=""></div>

        <!-- Navbar end -->
        <div v-if="store.authenticated" class="flex gap-4">
          <div class="">{{ store.user.name }} ({{ store.user.email }}) - {{ store.user.id }}</div>
          <button class="" @click="signOut">Sign out</button>
        </div>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useRethinkIdStore } from "@/stores/rethinkid";
import { rid } from "@/rethinkid";

const store = useRethinkIdStore();

function signOut(): void {
  rid.logOut();
}
</script>
