import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import Games from "../views/Games.vue";
import Game from "../views/Game.vue";
import NotFound from "../views/NotFound.vue";

import { rid } from "@/rethinkid";

const routes: Array<RouteRecordRaw> = [
  // {
  //   path: "/callback",
  //   name: "callback",
  //   component: Callback,
  //   meta: { requiresAuth: false },
  // },

  {
    path: "/",
    name: "home",
    component: Games,
    meta: { requiresAuth: false },
  },
  {
    path: "/games/:hostId/:guestId",
    name: "game",
    component: Game,
  },
  {
    path: "/:catchAll(.*)",
    component: NotFound,
    name: "notFound",
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

router.beforeEach((to, from, next) => {
  // If route requires auth
  if (to.matched.some((record) => record.meta.requiresAuth !== false)) {
    if (!rid.isLoggedIn()) {
      // Redirect to the sign in view if no token found and route requires auth
      next({ name: "home" });
      return;
    }
  }

  next();
});

export default router;
