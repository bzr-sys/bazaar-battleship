import type { Doc } from "@bzr/bazaar";

type GameCommon = Doc & {
  visible: boolean;
  lastActive: string;
};

export type HostedGame = GameCommon & {
  type: "hosted";
  guestId: string;
  config: GameConfig;
  highscore: Highscore;
  status: GameStatus;
};

export type InvitedGame = GameCommon & {
  type: "invited";
  hostId: string;
  grantedPermissionId: string;
  gameId: string;
};

export type GameLink = GameCommon & {
  type: "link";
  linkId: string;
  linkUrl: string;
};

export type Game = HostedGame | InvitedGame | GameLink;

export type GameType = "hosted" | "invited" | "link";

export type GameConfig = {
  hostUnset: string[];
  guestUnset: string[];
  hostShips: boolean[][];
  guestShips: boolean[][];
  hostBombs: boolean[][];
  guestBombs: boolean[][];
  // Added with the Sonar redesign; games started before it lack them.
  /** Each ship's squares (row * 10 + column), in the order of SHIPS in game.ts. */
  hostFleet?: number[][];
  guestFleet?: number[][];
  /** Squares fired at, in order. */
  hostShotLog?: number[];
  guestShotLog?: number[];
};

export type Highscore = {
  host: number;
  guest: number;
};

export type GameStatus = {
  currentTurn: string;
  hostSetup: boolean;
  guestSetup: boolean;
  finished: boolean;
};

export type SignUpIn = {
  email: string;
  password: string;
};
