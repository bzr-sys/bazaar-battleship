import { createStore } from "vuex";
import { State, User, Game } from "@/types";
import { rid } from "@/rethinkid";

const HOSTED_GAMES_TABLE_NAME = "hosted_games";
const INVITED_GAMES_TABLE_NAME = "invited_games";

const state: State = {
  loaded: false,
  authenticated: false,
  user: {
    id: "",
    email: "",
    name: "",
  },
  hostedGames: [],
  invitedGames: [],

  hostedGamesTable: rid.table(HOSTED_GAMES_TABLE_NAME, async () => {
    await rid.permissionsSet([
      {
        tableName: HOSTED_GAMES_TABLE_NAME,
        userId: "*",
        type: "read",
        condition: {
          matchUserId: "id",
        },
      },
      {
        tableName: HOSTED_GAMES_TABLE_NAME,
        userId: "*",
        type: "update",
        condition: {
          matchUserId: "id",
        },
      },
    ]);
    return;
  }),
  invitedGamesTable: rid.table(INVITED_GAMES_TABLE_NAME, async () => {
    await rid.permissionsSet([
      {
        tableName: INVITED_GAMES_TABLE_NAME,
        userId: "*",
        type: "insert",
        condition: {
          matchUserId: "id",
        },
      },
    ]);
  }),
};

export default createStore({
  state,
  mutations: {
    SET_LOADED: (state, loaded: boolean) => {
      state.loaded = loaded;
    },
    SIGN_IN: (state, user: User) => {
      state.authenticated = true;
      state.user = user;
    },
    SET_HOSTED_GAMES(state, games: Game[]) {
      state.hostedGames = games;
    },
    SET_INVITED_GAMES(state, games: User[]) {
      state.invitedGames = games;
    },
    CREATE_GAME(state, game: Game) {
      state.hostedGames.push(game);
    },
  },
  actions: {
    async autoSignIn({ commit, dispatch }) {
      if (rid.isLoggedIn()) {
        try {
          const user = rid.userInfo();
          console.log("user", user);
          commit("SIGN_IN", user);

          await dispatch("fetchHostedGames");
          await dispatch("fetchInvitedGames");

          commit("SET_LOADED", true);
        } catch (e: any) {
          console.error("tableRead error", e);
        }
      } else {
        commit("SET_LOADED", true);
      }
    },
    async fetchHostedGames({ state, commit }): Promise<void> {
      console.log("fetchHostedGames");
      try {
        const readResponse = await state.hostedGamesTable.read();
        commit("SET_HOSTED_GAMES", readResponse.data);
        console.log("readResponse", readResponse);
      } catch (err) {
        console.log("Error reading table:", err);
      }
    },
    async fetchInvitedGames({ state, commit }): Promise<void> {
      console.log("fetchInvitedGames");
      try {
        const readResponse = await state.invitedGamesTable.read();
        commit("SET_INVITED_GAMES", readResponse.data);
        console.log("readResponse", readResponse);
      } catch (err) {
        console.log("Error reading table:", err);
      }
    },
    async createGame({ commit, state }, userId: string): Promise<boolean> {
      try {
        // TODO RETHINKID: this will fail if target user does not use app (DB does not exist)
        const response = await rid.tableInsert(INVITED_GAMES_TABLE_NAME, state.user, { userId: userId });
        console.log("send invitation response", response);
      } catch (e: any) {
        console.log("failed to create game (invitation):", e);
        // probably the user does not use the app, or already exists
        return false;
      }
      const allShips = ["carrier", "battleship", "destroyer", "submarine", "patrol_boat"];
      const allFalse = Array(10).fill(Array(10).fill(false));
      // TODO RETHINKID: contacts, invite by email address
      const game: Game = {
        id: userId,
        host: state.user.id, // TODO not needed
        guest: {
          id: userId,
          email: "",
          name: "",
        },
        config: {
          hostUnset: allShips,
          guestUnset: allShips,
          hostShips: allFalse,
          guestShips: allFalse,
          hostBombs: allFalse,
          guestBombs: allFalse,
        },
        highscore: {
          host: 0,
          guest: 0,
        },
        status: {
          hostOnline: 0,
          guestOnline: 0,
          currentTurn: userId,
          hostSetup: false,
          guestSetup: false,
          finished: false,
        },
      };
      const response = state.hostedGamesTable.insert(game);
      console.log("create game response", response);
      commit("CREATE_GAME", game);
      return true;
    },
  },
  getters: {},
  modules: {},
});
