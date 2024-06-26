import { ref, computed } from "vue";
import type { ComputedRef } from "vue";
import { defineStore } from "pinia";
import { bzr } from "@/bazaar";
import type { Game, GameType, HostedGame, InvitedGame } from "@/types/index";

import { PermissionType } from "@bzr/bazaar";
import type { User, GrantedPermission } from "@bzr/bazaar";

export const GAMES_COLLECTION_NAME = "games";
export const HOSTED_GAME_TYPE = "hosted";
export const INVITED_GAME_TYPE = "invited";
export const LINK_GAME_TYPE = "link";

export function freshGameConfig() {
  const allShips = ["carrier", "battleship", "destroyer", "submarine", "patrol_boat"];
  const allFalse = Array(10).fill(Array(10).fill(false));
  return {
    hostUnset: allShips,
    guestUnset: allShips,
    hostShips: allFalse,
    guestShips: allFalse,
    hostBombs: allFalse,
    guestBombs: allFalse,
  };
}

export const useBazaarStore = defineStore("bazaar", () => {
  const loaded = ref(false);
  const authenticated = ref(false);
  const user = ref({
    id: "",
    handle: "",
    name: "",
  } as User);
  const games = ref([] as Game[]);
  const invitedGames: ComputedRef<InvitedGame[]> = computed(
    () => games.value.filter((g: Game) => g && g.type === INVITED_GAME_TYPE) as InvitedGame[],
  );
  const visibleGames = computed(() => {
    const visible = games.value.filter((g) => g && g.visible);
    for (const v of visible) {
      if (!v.name) {
        if (v.type === HOSTED_GAME_TYPE) {
          bzr.social.getUser({ userId: v.guestId }).then((u: User) => {
            v.name = u.name;
          });
        }
        if (v.type === INVITED_GAME_TYPE) {
          bzr.social.getUser({ userId: v.hostId }).then((u: User) => {
            v.name = u.name;
          });
        }
      }
    }
    return visible.sort((a: Game, b: Game) => Date.parse(b.lastActive) - Date.parse(a.lastActive));
  });

  const gamesCollection = bzr.collection<Game>(GAMES_COLLECTION_NAME);

  async function checkGranted(g: GrantedPermission) {
    if (
      g.permission &&
      g.permission.collectionName === GAMES_COLLECTION_NAME &&
      g.permission.filter &&
      g.permission.filter.id &&
      typeof g.permission.filter.id === "string"
    ) {
      let found = false;
      for (const game of invitedGames.value) {
        if (game.grantedPermissionId === g.id) {
          found = true;
          break;
        }
      }
      if (!found) {
        gamesCollection.insertOne({
          type: INVITED_GAME_TYPE,
          visible: true,
          lastActive: "$now",
          // invited game specific
          hostId: g.ownerId,
          grantedPermissionId: g.id,
          gameId: g.permission.filter.id,
        });
      }
      // Check if granted via link
      const c = bzr.collection<Game>(GAMES_COLLECTION_NAME, { userId: g.ownerId });
      const game = await c.getOne(g.permission.filter.id as string);
      if (game && game.type === LINK_GAME_TYPE) {
        await c.updateOne(g.permission.filter.id as string, {
          type: HOSTED_GAME_TYPE,
          lastActive: "$now",
          guestId: user.value.id,
          config: freshGameConfig(),
          highscore: {
            host: 0,
            guest: 0,
          },
          status: {
            currentTurn: user.value.id,
            hostSetup: false,
            guestSetup: false,
            finished: false,
          },
        });
      }
    }
  }

  async function autoSignIn() {
    if (bzr.isLoggedIn()) {
      try {
        user.value = await bzr.social.getUser();
        authenticated.value = true;

        // @ts-ignore Property 'mirrorAll' is private and only accessible within class 'CollectionAPI<T>'
        await gamesCollection.mirrorAll({}, games.value);

        await bzr.permissions.granted.subscribe({ collectionName: GAMES_COLLECTION_NAME }, (change) => {
          if (change.newDoc) {
            checkGranted(change.newDoc);
          }
        });
        const granted = await bzr.permissions.granted.list({ collectionName: GAMES_COLLECTION_NAME });
        for (const g of granted) {
          checkGranted(g);
        }

        loaded.value = true;
      } catch (e: unknown) {
        console.error("Error during auto signin", e);
      }
    } else {
      loaded.value = true;
    }
  }

  async function createGame(userId: string) {
    const game = {
      type: HOSTED_GAME_TYPE,
      visible: true,
      lastActive: "$now",
      // hosted game specific
      guestId: userId,
      config: freshGameConfig(),
      highscore: {
        host: 0,
        guest: 0,
      },
      status: {
        currentTurn: userId,
        hostSetup: false,
        guestSetup: false,
        finished: false,
      },
    } as Omit<HostedGame, "id">;
    const gameId = await gamesCollection.insertOne(game);
    bzr.permissions.create({
      collectionName: GAMES_COLLECTION_NAME,
      userId: userId,
      types: [PermissionType.READ, PermissionType.UPDATE],
      filter: {
        id: gameId,
      },
    });
  }

  async function createLink() {
    const game = {
      type: LINK_GAME_TYPE as GameType,
      visible: true,
      lastActive: "$now",
      // link game specific
      // linkId: "",
      // linkUrl: ""
    };
    const gameId = await gamesCollection.insertOne(game);
    const link = await bzr.permissions.links.create(
      {
        collectionName: GAMES_COLLECTION_NAME,
        types: [PermissionType.READ, PermissionType.UPDATE],
        filter: {
          id: gameId,
        },
      },
      "Link for new game",
      1,
    );
    gamesCollection.updateOne(gameId, { linkId: link.id, linkUrl: link.url });
    return link.url;
  }

  async function hideGame(gameId: string) {
    gamesCollection.updateOne(gameId, { visible: false });
  }

  return { loaded, authenticated, user, visibleGames, autoSignIn, createGame, createLink, hideGame };
});
