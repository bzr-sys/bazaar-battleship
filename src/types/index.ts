import type { Doc } from "@bzr/bazaar";

type GameCommon = Doc & {
  visible: boolean;
  lastActive: string;

  name?: string; // Added by store
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
