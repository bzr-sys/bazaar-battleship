import { ref, computed } from "vue";
import type { Ref, ComputedRef } from "vue";
import { defineStore } from "pinia";
import { rid } from "@/rethinkid";
import type { Game, InvitedGame } from "@/types/index";

import { PermissionType, CollectionAPI } from "@rethinkid/rethinkid-js-sdk";
import type { User, Doc, FilterObject, GrantedPermission } from "@rethinkid/rethinkid-js-sdk";

export const GAMES_COLLECTION_NAME = "games";
export const HOSTED_GAME_TYPE = "hosted";
export const INVITED_GAME_TYPE = "invited";
export const LINK_GAME_TYPE = "link";

async function mirrorAll<T extends Doc>(filter: FilterObject, collection: CollectionAPI<T>, data: Ref<T[]>) {
  data.value = await collection.getAll(filter);
  return await collection.subscribeAll(filter, (changes) => {
    if (!changes.oldDoc) {
      // New doc
      data.value.push(changes.newDoc!);
      return;
    }
    if (!changes.newDoc) {
      // Deleted doc
      const idx = data.value.findIndex((doc) => doc.id === changes.oldDoc!.id);
      if (idx > -1) {
        data.value.splice(idx, 1);
      }
      return;
    }
    // Changed doc
    const idx = data.value.findIndex((doc) => doc.id === changes.newDoc!.id);
    data.value[idx] = changes.newDoc!;
    return;
  });
}

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

export const useRethinkIdStore = defineStore("rethinkid", () => {
  const loaded = ref(false);
  const authenticated = ref(false);
  const user = ref({
    id: "",
    email: "",
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
          rid.social.getUser(v.guestId).then((u: User) => {
            v.name = u.name;
          });
        }
        if (v.type === INVITED_GAME_TYPE) {
          rid.social.getUser(v.hostId).then((u: User) => {
            v.name = u.name;
          });
        }
      }
    }
    return visible.sort((a: Game, b: Game) => Date.parse(b.lastActive) - Date.parse(a.lastActive));
  });

  const gamesCollection = rid.collection<Game>(GAMES_COLLECTION_NAME);

  async function checkGranted(g: GrantedPermission) {
    if (
      g.permission &&
      g.permission.collectionName === GAMES_COLLECTION_NAME &&
      g.permission.filter &&
      g.permission.filter.id
    ) {
      console.log("valid permission");
      let found = false;
      for (const game of invitedGames.value) {
        if (game.grantedPermissionId === g.id) {
          found = true;
          console.log("found");
          break;
        }
      }
      if (!found) {
        console.log("not found, insert");
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
      const c = rid.collection<Game>(GAMES_COLLECTION_NAME, { userId: g.ownerId });
      const game = await c.getOne(g.permission.filter.id as string);
      console.log("game");
      console.log(game);
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
    console.log("autosignin:", rid.isLoggedIn());
    if (rid.isLoggedIn()) {
      try {
        user.value = await rid.social.getUser();
        console.log("user", user.value);
        authenticated.value = true;

        // await gamesCollection.mirrorAll({}, games.value);
        await mirrorAll({}, gamesCollection, games);

        await rid.permissions.granted.subscribe({ collectionName: GAMES_COLLECTION_NAME }, (change) => {
          if (change.newDoc) {
            checkGranted(change.newDoc);
          }
        });
        const granted = await rid.permissions.granted.list({ collectionName: GAMES_COLLECTION_NAME });
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
      guestID: userId,
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
    };
    const gameId = await gamesCollection.insertOne(game);
    rid.permissions.create({
      collectionName: GAMES_COLLECTION_NAME,
      userId: userId,
      types: [PermissionType.READ, PermissionType.UPDATE],
      filter: {
        id: gameId,
      },
    });
    console.log("create game done");
  }

  async function createLink() {
    const game = {
      type: LINK_GAME_TYPE,
      visible: true,
      lastActive: "$now",
      // link game specific
      // linkId: "",
      // linkUrl: ""
    };
    const gameId = await gamesCollection.insertOne(game);
    const link = await rid.permissions.links.create(
      {
        collectionName: GAMES_COLLECTION_NAME,
        types: [PermissionType.READ, PermissionType.UPDATE],
        filter: {
          id: gameId,
        },
      },
      1,
    );
    gamesCollection.updateOne(gameId, { linkId: link.id, linkUrl: link.url });
    console.log("create game done");
    return link.url;
  }

  async function hideGame(gameId: string) {
    gamesCollection.updateOne(gameId, { visible: false });
  }

  return { loaded, authenticated, user, visibleGames, autoSignIn, createGame, createLink, hideGame };
});
