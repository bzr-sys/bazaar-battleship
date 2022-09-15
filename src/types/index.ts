import { CallExpression } from "@babel/types";
import { Table } from "@mostlytyped/rethinkid-js-sdk/dist/types/table";

export type State = {
  loaded: boolean;
  authenticated: boolean;
  user: User;
  hostedGames: Game[];
  invitedGames: User[];
};

export type User = {
  id: string;
  email: string;
  name: string;
};

export type Game = {
  id: string;
  host: string;
  guest: User;
  config: GameConfig;
  highscore: Highscore;
  status: GameStatus;
};

export type GameConfig = {
  hostUnset: string[];
  guestUnset: string[];
  hostShips: boolean[][];
  guestShips: boolean[][];
  hostBombs: boolean[][];
  guestBombs: boolean[][];
};

export type Highscore = {
  host: number;
  guest: number;
};

export type GameStatus = {
  hostOnline: number; // TODO RethinkID how?
  guestOnline: number; // TODO RethinkID how?
  currentTurn: string;
  hostSetup: boolean;
  guestSetup: boolean;
  finished: boolean;
};

export type SignUpIn = {
  email: string;
  password: string;
};
