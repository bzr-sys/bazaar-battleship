<template>
  <AppNav />
  <router-view v-if="loaded" :aria-hidden="isModalOpen" />
  <div class="loading" v-else>Loading...</div>
  <AppServiceWorkerNotification />
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "vuex";
import useModals from "@/composables/modals";
import AppNav from "@/components/AppNav.vue";
import AppServiceWorkerNotification from "@/components/AppServiceWorkerNotification.vue";

export default defineComponent({
  name: "App",
  components: {
    AppNav,
    AppServiceWorkerNotification,
  },
  setup() {
    const store = useStore();

    const loaded = computed(() => store.state.loaded);

    store.dispatch("autoSignIn");

    const { isModalOpen } = useModals;

    return { isModalOpen, loaded };
  },
});
</script>

<style lang="scss">
@import "~normalize.css/normalize.css";
@import "~bulma/bulma.sass";

// apply a natural box layout model to all elements, but allowing components to change
html {
  background: hsl(189, 50%, 80%);
  box-sizing: border-box;
}

*,
*:before,
*:after {
  box-sizing: inherit;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

.small-container {
  margin: 0 auto;
  max-width: 440px;
}

.loading {
  color: white;
  padding: 1em;
}
</style>
