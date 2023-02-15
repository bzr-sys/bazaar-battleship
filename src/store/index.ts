import { createStore } from "vuex";
import { State, User, Game } from "@/types";
import { rid } from "@/rethinkid";
import { AcceptedInvitation, Invitation, ReceivedInvitation } from "@mostlytyped/rethinkid-js-sdk/dist/types/types";

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

  invitations: [],
  receivedInvitations: [],
  acceptedInvitations: [],

  hostedGamesTable: rid.table(HOSTED_GAMES_TABLE_NAME, {
    onCreate: async () => {
      await rid.permissions.set([
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
    },
  }),
  invitedGamesTable: rid.table(INVITED_GAMES_TABLE_NAME, {
    onCreate: async () => {
      await rid.permissions.set([
        {
          tableName: INVITED_GAMES_TABLE_NAME,
          userId: "*",
          type: "insert",
          condition: {
            matchUserId: "id",
          },
        },
      ]);
    },
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
    SET_INVITATIONS(state, invitations: Invitation[]) {
      state.invitations = invitations;
    },
    CREATE_GAME(state, game: Game) {
      state.hostedGames.push(game);
    },
    APPEND_RECEIVED_INVITATION(state, inv: ReceivedInvitation) {
      state.receivedInvitations.push(inv);
    },
    REMOVE_RECEIVED_INVITATION(state, id: string) {
      const index = state.receivedInvitations.findIndex((i) => {
        return i.id == id;
      });
      if (index > -1) {
        state.receivedInvitations.splice(index, 1);
      }
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
          await dispatch("fetchInvitations");

          rid.invitations.onReceived((req: ReceivedInvitation) => {
            console.log("onReceivedInvitations");
            dispatch("addReceivedInvitation", req);
          });
          rid.invitations.onAccepted((inv: AcceptedInvitation) => {
            console.log("onAcceptedInvitations");
            // TODO check game does not exist yet
            dispatch("createGame", inv.userId);
            rid.invitations.handleAccepted(inv.id);
            dispatch("fetchInvitations");
          });

          commit("SET_LOADED", true);
        } catch (e: any) {
          console.error("tableRead error", e);
        }
      } else {
        commit("SET_LOADED", true);
      }
    },
    async addReceivedInvitation({ commit }, inv: ReceivedInvitation) {
      commit("APPEND_RECEIVED_INVITATION", inv);
    },
    async fetchHostedGames({ state, commit }): Promise<void> {
      console.log("fetchHostedGames");
      try {
        const readResponse = await state.hostedGamesTable.read();
        commit("SET_HOSTED_GAMES", readResponse);
        console.log("readResponse", readResponse);
      } catch (err) {
        console.log("Error reading table:", err);
      }
    },
    async fetchInvitedGames({ state, commit }): Promise<void> {
      console.log("fetchInvitedGames");
      try {
        const readResponse = await state.invitedGamesTable.read();
        commit("SET_INVITED_GAMES", readResponse);
        console.log("readResponse", readResponse);
      } catch (err) {
        console.log("Error reading table:", err);
      }
    },
    async fetchInvitations({ state, commit }): Promise<void> {
      console.log("fetchInvitations");
      try {
        const invitations = await rid.invitations.list();
        commit("SET_INVITATIONS", invitations);
        console.log("readResponse", invitations);
      } catch (err) {
        console.log("Error reading table:", err);
      }
    },
    async inviteUser({ dispatch }, userId: string): Promise<any> {
      console.log("inviteUser");
      try {
        const invitationResponse = await rid.invitations.inviteUser(userId, {});
        console.log("invitationResponse", invitationResponse);
        dispatch("fetchInvitations");
      } catch (err) {
        console.log("Error reading table:", err);
      }
    },
    async acceptInvitation({ commit, dispatch }, invitation: ReceivedInvitation): Promise<any> {
      console.log("acceptInvitation:", invitation);
      try {
        const response = await rid.table(INVITED_GAMES_TABLE_NAME).insert({ userId: invitation.hostId });
        const acceptResponse = await rid.invitations.acceptReceived(invitation.id);
        await rid.invitations.deleteReceived(invitation.id);
        commit("REMOVE_RECEIVED_INVITATION", invitation.id);
        dispatch("fetchInvitedGames");
        console.log("acceptResponse", acceptResponse);
      } catch (err) {
        console.log("Error accepting invitation:", err);
      }
    },
    async createGame({ commit, state }, userId: string): Promise<boolean> {
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
