import { ref, computed, reactive, watch } from "vue";
import type { ComputedRef } from "vue";
import { defineStore } from "pinia";
import { bzr } from "@/bazaar";
import type { Game, GameLink, GameType, HostedGame, InvitedGame } from "@/types/index";
import { freshGameConfig, perspective, phaseOf } from "@/game";
import type { Perspective, Phase } from "@/game";

import { arrayMirrorSubscribeListener, GranteeType, PermissionType } from "@bzr/bazaar";
import type { CollectionAPI, DeepPartial, User, GrantedPermission } from "@bzr/bazaar";

export const GAMES_COLLECTION_NAME = "games";
export const HOSTED_GAME_TYPE = "hosted";
export const INVITED_GAME_TYPE = "invited";
export const LINK_GAME_TYPE = "link";

export { freshGameConfig };

/** A game as the signed-in user sees it, whichever database it lives in. */
export type Engagement = {
  /** The entry's ID in the user's own games collection (used in the URL). */
  id: string;
  entry: HostedGame | InvitedGame;
  /** The live game: undefined while loading, null if it can no longer be read. */
  game: HostedGame | null | undefined;
  isHost: boolean;
  opponentId: string;
  view?: Perspective;
  phase?: Phase;
};

export const useBazaarStore = defineStore("bazaar", () => {
  const loaded = ref(false);
  const authenticated = ref(false);
  const user = ref({
    id: "",
    handle: "",
    name: "",
  } as User);
  const games = ref([] as Game[]);
  const people = reactive({} as Record<string, User | null>);

  // Invited games live in the host's database: entry ID -> live copy.
  const remote = reactive({} as Record<string, HostedGame | null>);
  const remoteCollections = new Map<string, CollectionAPI<HostedGame>>();

  const gamesCollection = bzr.collection<Game>(GAMES_COLLECTION_NAME);

  function ensurePerson(userId: string) {
    if (!userId || userId in people) return;
    people[userId] = null;
    bzr.social
      .getUser({ userId })
      .then((u: User) => {
        people[userId] = u;
      })
      .catch((err) => console.log("Could not load user", userId, err));
  }

  async function watchRemote(entry: InvitedGame) {
    if (remoteCollections.has(entry.id)) return;
    try {
      const ctx = await bzr.createContext({ ownerId: entry.hostId });
      const c = ctx.collection<HostedGame>(GAMES_COLLECTION_NAME);
      remoteCollections.set(entry.id, c);
      await c.subscribeOne(entry.gameId, {
        onInitial: (doc) => {
          remote[entry.id] = doc;
        },
        onAdd: (doc) => {
          remote[entry.id] = doc;
        },
        onChange: (_old, doc) => {
          remote[entry.id] = doc;
        },
        onDelete: () => {
          remote[entry.id] = null;
        },
      });
      if (!(entry.id in remote)) remote[entry.id] = null;
    } catch (err) {
      console.log("Could not load game from", entry.hostId, err);
      remote[entry.id] = null;
    }
  }

  const engagements: ComputedRef<Engagement[]> = computed(() => {
    const out: Engagement[] = [];
    for (const g of games.value) {
      if (!g || !g.visible) continue;
      if (g.type === HOSTED_GAME_TYPE) {
        out.push({ id: g.id, entry: g, game: g, isHost: true, opponentId: g.guestId });
      } else if (g.type === INVITED_GAME_TYPE) {
        out.push({ id: g.id, entry: g, game: remote[g.id], isHost: false, opponentId: g.hostId });
      }
    }
    for (const e of out) {
      if (e.game && e.game.config && e.game.status) {
        e.view = perspective(e.game, e.isHost, user.value.id);
        e.phase = phaseOf(e.view);
      }
    }
    return out;
  });

  const links = computed(() => games.value.filter((g) => g && g.visible && g.type === LINK_GAME_TYPE) as GameLink[]);

  // Keep remote games and opponent names loaded for everything in the lobby.
  watch(
    () => games.value.map((g) => g && `${g.id}:${g.type}`).join(),
    () => {
      for (const g of games.value) {
        if (!g) continue;
        if (g.type === INVITED_GAME_TYPE) {
          ensurePerson(g.hostId);
          watchRemote(g);
        } else if (g.type === HOSTED_GAME_TYPE) {
          ensurePerson(g.guestId);
        }
      }
    },
  );

  const invitedGames = computed(() => games.value.filter((g) => g && g.type === INVITED_GAME_TYPE) as InvitedGame[]);

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
      const ctx = await bzr.createContext({ ownerId: g.ownerId });
      const c = ctx.collection<Game>(GAMES_COLLECTION_NAME);
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

  let signingIn = false;
  async function autoSignIn() {
    if (bzr.isLoggedIn()) {
      if (signingIn || authenticated.value) return;
      signingIn = true;
      try {
        user.value = await bzr.social.getUser();
        authenticated.value = true;

        await gamesCollection.subscribeAll({}, arrayMirrorSubscribeListener(games.value));

        await bzr.permissions.granted.subscribe(
          { collectionName: GAMES_COLLECTION_NAME },
          {
            onAdd: (newDoc) => {
              checkGranted(newDoc);
            },
            onChange: (_oldDoc, newDoc) => {
              checkGranted(newDoc);
            },
          },
        );
        const granted = await bzr.permissions.granted.list({ collectionName: GAMES_COLLECTION_NAME });
        for (const g of granted) {
          checkGranted(g);
        }

        loaded.value = true;
      } catch (e: unknown) {
        console.error("Error during auto signin", e);
      } finally {
        signingIn = false;
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
    await bzr.permissions.create({
      collectionName: GAMES_COLLECTION_NAME,
      granteeType: GranteeType.USER,
      granteeId: userId,
      types: [PermissionType.READ, PermissionType.UPDATE],
      filter: {
        id: gameId,
      },
    });
    return gameId;
  }

  async function createLink() {
    const game = {
      type: LINK_GAME_TYPE as GameType,
      visible: true,
      lastActive: "$now",
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
    await gamesCollection.updateOne(gameId, { linkId: link.id, linkUrl: link.url });
    return link.url;
  }

  async function hideGame(gameId: string) {
    await gamesCollection.updateOne(gameId, { visible: false });
  }

  /** Writes a partial update to the game behind an engagement, wherever it lives. */
  async function updateGame(e: Engagement, update: DeepPartial<HostedGame>) {
    if (e.isHost) {
      await gamesCollection.updateOne(e.entry.id, update as DeepPartial<Game>);
      return;
    }
    const entry = e.entry as InvitedGame;
    const c = remoteCollections.get(entry.id);
    if (!c) throw new Error("This game is not loaded yet");
    await c.updateOne(entry.gameId, update);
    // Bring the invited entry to the top of the host's lobby order too.
    gamesCollection.updateOne(entry.id, { lastActive: "$now" }).catch(() => {});
  }

  /** Starts the next game of the series. The loser of the last one fires first. */
  async function rematch(e: Engagement) {
    await updateGame(e, {
      lastActive: "$now",
      config: freshGameConfig(),
      status: { hostSetup: false, guestSetup: false, finished: false },
    });
  }

  return {
    loaded,
    authenticated,
    user,
    games,
    people,
    engagements,
    links,
    autoSignIn,
    createGame,
    createLink,
    hideGame,
    updateGame,
    rematch,
  };
});
