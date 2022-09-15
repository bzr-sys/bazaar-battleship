/**
 * Typing $store Property in Vue Component
 * https://next.vuex.vuejs.org/guide/typescript-support.html
 */

/* eslint-disable */

import { ComponentCustomProperties } from "vue";
import { Store } from "vuex";
import { State } from "@/types";

declare module "@vue/runtime-core" {
  // provide typings for `this.$store`
  interface ComponentCustomProperties {
    $store: Store<State>;
  }
}
