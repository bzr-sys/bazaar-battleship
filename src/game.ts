// Board rules and derived game state. Everything here is pure so the views
// and the store can share it.
import type { GameConfig, HostedGame } from "@/types";

export const SIZE = 10;
export const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
export const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// The order of SHIPS is the order of the fleet arrays stored in GameConfig.
export const SHIPS = [
  { id: "carrier", name: "Carrier", size: 5 },
  { id: "battleship", name: "Battleship", size: 4 },
  { id: "destroyer", name: "Destroyer", size: 3 },
  { id: "submarine", name: "Submarine", size: 3 },
  { id: "patrol_boat", name: "Patrol boat", size: 2 },
] as const;

export type Orientation = "h" | "v";

/** A square as one number: row * 10 + column. */
export const cellIndex = (row: number, col: number) => row * SIZE + col;
export const coord = (i: number) => `${ROWS[Math.floor(i / SIZE)]}${(i % SIZE) + 1}`;

export function emptyGrid(): boolean[][] {
  return Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
}

export function gridFromCells(cells: number[]): boolean[][] {
  const grid = emptyGrid();
  for (const i of cells) grid[Math.floor(i / SIZE)][i % SIZE] = true;
  return grid;
}

export function freshGameConfig(): GameConfig {
  const unset = SHIPS.map((s) => s.id);
  return {
    hostUnset: [...unset],
    guestUnset: [...unset],
    hostShips: emptyGrid(),
    guestShips: emptyGrid(),
    hostBombs: emptyGrid(),
    guestBombs: emptyGrid(),
    hostFleet: [],
    guestFleet: [],
    hostShotLog: [],
    guestShotLog: [],
  };
}

/** The squares a ship of `size` covers from (row, col), or null if it leaves the board. */
export function shipCells(size: number, row: number, col: number, o: Orientation): number[] | null {
  if (o === "h" ? col + size > SIZE : row + size > SIZE) return null;
  return Array.from({ length: size }, (_, k) => (o === "h" ? cellIndex(row, col + k) : cellIndex(row + k, col)));
}

/** Places every ship at random without overlaps. */
export function randomFleet(): number[][] {
  const taken = new Set<number>();
  return SHIPS.map((ship) => {
    for (;;) {
      const o: Orientation = Math.random() < 0.5 ? "h" : "v";
      const cells = shipCells(ship.size, Math.floor(Math.random() * SIZE), Math.floor(Math.random() * SIZE), o);
      if (cells && !cells.some((i) => taken.has(i))) {
        cells.forEach((i) => taken.add(i));
        return cells;
      }
    }
  });
}

const at = (grid: boolean[][] | undefined, i: number) => !!grid?.[Math.floor(i / SIZE)]?.[i % SIZE];

/** Everything about a game from one player's side. */
export type Perspective = {
  isHost: boolean;
  setup: boolean;
  opponentSetup: boolean;
  myShips: boolean[][];
  theirShips: boolean[][];
  /** My shots at their waters. */
  myShots: boolean[][];
  /** Their shots at my waters. */
  theirShots: boolean[][];
  /** Ship squares in SHIPS order; empty for games started before fleets were stored. */
  myFleet: number[][];
  theirFleet: number[][];
  myLog: number[];
  theirLog: number[];
  myScore: number;
  theirScore: number;
  myTurn: boolean;
  finished: boolean;
};

export function perspective(game: HostedGame, isHost: boolean, userId: string): Perspective {
  const c = game.config;
  const p = isHost
    ? {
        myShips: c.hostShips,
        theirShips: c.guestShips,
        myShots: c.hostBombs,
        theirShots: c.guestBombs,
        myFleet: c.hostFleet ?? [],
        theirFleet: c.guestFleet ?? [],
        myLog: c.hostShotLog ?? [],
        theirLog: c.guestShotLog ?? [],
        myScore: game.highscore.host,
        theirScore: game.highscore.guest,
        setup: game.status.hostSetup,
        opponentSetup: game.status.guestSetup,
      }
    : {
        myShips: c.guestShips,
        theirShips: c.hostShips,
        myShots: c.guestBombs,
        theirShots: c.hostBombs,
        myFleet: c.guestFleet ?? [],
        theirFleet: c.hostFleet ?? [],
        myLog: c.guestShotLog ?? [],
        theirLog: c.hostShotLog ?? [],
        myScore: game.highscore.guest,
        theirScore: game.highscore.host,
        setup: game.status.guestSetup,
        opponentSetup: game.status.hostSetup,
      };
  return { ...p, isHost, myTurn: game.status.currentTurn === userId, finished: game.status.finished };
}

export const isShip = (grid: boolean[][], i: number) => at(grid, i);
export const isShot = (grid: boolean[][], i: number) => at(grid, i);

/** True when every ship square in `ships` has been shot. */
export function allSunk(ships: boolean[][], shots: boolean[][]): boolean {
  for (let i = 0; i < SIZE * SIZE; i++) if (at(ships, i) && !at(shots, i)) return false;
  return true;
}

/** Which ships of `fleet` are sunk, in SHIPS order. */
export function sunkShips(fleet: number[][], shots: boolean[][]): boolean[] {
  return SHIPS.map((_, k) => !!fleet[k]?.length && fleet[k].every((i) => at(shots, i)));
}

/** The index in SHIPS of the ship on square `i`, or -1. */
export function shipAt(fleet: number[][], i: number): number {
  return fleet.findIndex((cells) => cells?.includes(i));
}

export type ShotResult = { kind: "miss" | "hit" | "sunk"; ship?: string };

/** What a shot at `i` did, given the target's ships and all shots fired at them so far. */
export function shotResult(ships: boolean[][], fleet: number[][], shots: boolean[][], i: number): ShotResult {
  if (!at(ships, i)) return { kind: "miss" };
  const k = shipAt(fleet, i);
  if (k >= 0 && fleet[k].every((j) => at(shots, j))) return { kind: "sunk", ship: SHIPS[k].name };
  return { kind: "hit" };
}

/** Like shotResult, but as of the moment the `n`th logged shot landed. */
export function loggedShotResult(ships: boolean[][], fleet: number[][], log: number[], n: number): ShotResult {
  return shotResult(ships, fleet, gridFromCells(log.slice(0, n + 1)), log[n]);
}

export function hitCount(ships: boolean[][], shots: boolean[][]): number {
  let n = 0;
  for (let i = 0; i < SIZE * SIZE; i++) if (at(ships, i) && at(shots, i)) n++;
  return n;
}

export function shotCount(shots: boolean[][]): number {
  let n = 0;
  for (let i = 0; i < SIZE * SIZE; i++) if (at(shots, i)) n++;
  return n;
}

export type Phase = "deploy" | "awaiting-deploy" | "salvo" | "incoming" | "won" | "lost";

export function phaseOf(p: Perspective): Phase {
  if (!p.setup) return "deploy";
  if (!p.opponentSetup) return "awaiting-deploy";
  if (p.finished) return allSunk(p.theirShips, p.myShots) ? "won" : "lost";
  return p.myTurn ? "salvo" : "incoming";
}

/** "2 min ago" style age of an ISO timestamp. */
export function ago(iso: string | undefined, now: number): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
