<script setup lang="ts">
import { computed } from "vue";
import SonarBoard from "@/components/SonarBoard.vue";
import type { BoardCell } from "@/components/SonarBoard.vue";
import {
  SHIPS,
  SIZE,
  coord,
  hitCount,
  isShip,
  isShot,
  loggedShotResult,
  pad2,
  shipAt,
  shotCount,
  sunkShips,
} from "@/game";
import type { Perspective, Phase } from "@/game";

const props = defineProps<{
  view: Perspective;
  phase: Phase;
  opponentName: string;
  /** The square of a shot on its way to the server. */
  pending: number | null;
  busy: boolean;
}>();

const emit = defineEmits<{ fire: [index: number]; rematch: [] }>();

const first = computed(() => props.opponentName.split(" ")[0]);
const over = computed(() => props.phase === "won" || props.phase === "lost");
const fleetKnown = computed(() => props.view.theirFleet.length === SHIPS.length);
const theirSunk = computed(() => sunkShips(props.view.theirFleet, props.view.myShots));
const mySunk = computed(() => sunkShips(props.view.myFleet, props.view.theirShots));

const targetCells = computed<BoardCell[]>(() => {
  const v = props.view;
  const last = v.myLog[v.myLog.length - 1];
  return Array.from({ length: SIZE * SIZE }, (_, i) => {
    const shot = isShot(v.myShots, i);
    const ship = isShip(v.theirShips, i);
    const k = shipAt(v.theirFleet, i);
    let cls = "";
    let state = "not fired at";
    if (shot && ship && k >= 0 && theirSunk.value[k]) [cls, state] = ["sunk", `sunk ${SHIPS[k].name}`];
    else if (shot && ship) [cls, state] = ["hit", "hit"];
    else if (shot) [cls, state] = ["miss", "miss"];
    else if (props.pending === i) [cls, state] = ["pending", "firing"];
    else if (over.value && ship) [cls, state] = ["reveal", "ship you did not find"];
    else if (props.phase === "salvo" && props.pending === null) [cls, state] = ["armed", "fire here"];
    if (i === last) cls += " last";
    return { cls, label: `${coord(i)}, ${state}`, disabled: !cls.startsWith("armed") };
  });
});

const ownCells = computed<BoardCell[]>(() => {
  const v = props.view;
  const last = v.theirLog[v.theirLog.length - 1];
  return Array.from({ length: SIZE * SIZE }, (_, i) => {
    const shot = isShot(v.theirShots, i);
    const ship = isShip(v.myShips, i);
    const k = shipAt(v.myFleet, i);
    const name = k >= 0 ? SHIPS[k].name : "ship";
    let cls = "";
    let state = "water";
    if (ship && shot && k >= 0 && mySunk.value[k]) [cls, state] = ["sunk", `${name} sunk`];
    else if (ship && shot) [cls, state] = ["ship-hit", `${name} hit`];
    else if (ship) [cls, state] = ["ship", name];
    else if (shot) [cls, state] = ["miss", "miss"];
    if (i === last) cls += " last";
    return { cls, label: `${coord(i)}, ${state}` };
  });
});

const enemyFleet = computed(() =>
  SHIPS.map((s, k) => ({ name: s.name, size: s.size, sunk: fleetKnown.value && theirSunk.value[k] })),
);
const myFleet = computed(() =>
  SHIPS.map((s, k) => {
    const cells = props.view.myFleet[k] ?? [];
    return {
      name: s.name,
      size: s.size,
      sunk: mySunk.value[k],
      hits: cells.filter((i) => isShot(props.view.theirShots, i)).length,
    };
  }),
);
const enemyLeft = computed(() => enemyFleet.value.filter((s) => !s.sunk).length);
const myLeft = computed(() => myFleet.value.filter((s) => !s.sunk).length);

const shots = computed(() => shotCount(props.view.myShots));
const hits = computed(() => hitCount(props.view.theirShips, props.view.myShots));
const accuracy = computed(() => (shots.value ? `${Math.round((hits.value * 100) / shots.value)}%` : "--"));

type LogEntry = { n: string; who: string; mine: boolean; at: string; result: string; tone: string };

// Shots alternate, so the two logs interleave. Whoever has fired more went
// first; with equal counts it is whoever moves next (or the loser, once over).
const log = computed<LogEntry[]>(() => {
  const v = props.view;
  const m = v.myLog.length;
  const t = v.theirLog.length;
  const iStarted = m !== t ? m > t : over.value ? props.phase === "lost" : v.myTurn;
  const entries: LogEntry[] = [];
  const add = (mine: boolean, n: number) => {
    const r = mine
      ? loggedShotResult(v.theirShips, v.theirFleet, v.myLog, n)
      : loggedShotResult(v.myShips, v.myFleet, v.theirLog, n);
    entries.push({
      n: "",
      who: mine ? "YOU" : first.value.toUpperCase(),
      mine,
      at: coord(mine ? v.myLog[n] : v.theirLog[n]),
      result: r.kind === "sunk" ? `SUNK ${r.ship?.toUpperCase()}` : r.kind.toUpperCase(),
      tone: r.kind === "sunk" ? "text-sonar-flare-text" : r.kind === "hit" ? "text-sonar-amber" : "text-sonar-dim",
    });
  };
  for (let n = 0; n < Math.max(m, t); n++) {
    if (iStarted) {
      if (n < m) add(true, n);
      if (n < t) add(false, n);
    } else {
      if (n < t) add(false, n);
      if (n < m) add(true, n);
    }
  }
  entries.forEach((e, k) => (e.n = pad2(k + 1)));
  return entries.reverse().slice(0, 8);
});

const banner = computed(() => {
  const name = props.opponentName;
  switch (props.phase) {
    case "salvo":
      return { title: "Your salvo", text: `Select a target square in ${first.value}'s waters.`, tone: "amber" };
    case "incoming":
      return { title: "Incoming", text: `${name} is choosing a target. Safe to leave this screen.`, tone: "cyan" };
    case "awaiting-deploy":
      return {
        title: "Awaiting deployment",
        text: `${name} is still placing ships. ${props.view.myTurn ? "You fire first." : `${first.value} fires first.`}`,
        tone: "cyan",
      };
    case "won":
      return { title: "Victory", text: `${name}'s fleet destroyed in ${shots.value} shots.`, tone: "amber" };
    default:
      return {
        title: "Fleet lost",
        text: `${name} found every ship. Their surviving ships are outlined.`,
        tone: "flare",
      };
  }
});

const lastTheirs = computed(() => {
  const v = props.view;
  if (!v.theirLog.length) return "";
  const r = loggedShotResult(v.myShips, v.myFleet, v.theirLog, v.theirLog.length - 1);
  const what = r.kind === "sunk" ? `sank your ${r.ship}` : r.kind === "hit" ? "hit" : "missed";
  return `${first.value} fired at ${coord(v.theirLog[v.theirLog.length - 1])}: ${what}`;
});
</script>

<template>
  <div class="flex flex-col gap-5">
    <div
      role="status"
      class="flex flex-wrap items-center gap-x-5 gap-y-2 border px-4 py-3.5"
      :class="{
        'border-sonar-amber bg-sonar-amber-deep': banner.tone === 'amber',
        'border-sonar-line bg-sonar-panel': banner.tone === 'cyan',
        'border-sonar-flare bg-sonar-panel': banner.tone === 'flare',
      }"
    >
      <span
        class="hd text-[28px]"
        :class="{
          'text-sonar-amber': banner.tone === 'amber',
          'text-sonar-cyan': banner.tone === 'cyan',
          'text-sonar-flare-text': banner.tone === 'flare',
        }"
      >
        {{ banner.title }}
      </span>
      <span class="flex-[1_1_260px]">{{ banner.text }}</span>
      <div v-if="over" class="flex flex-wrap gap-2">
        <button class="btn-amber" :disabled="busy" @click="emit('rematch')">
          {{ busy ? "Starting…" : "Rematch" }}
        </button>
        <RouterLink :to="{ name: 'home' }" class="btn-outline">Stand down</RouterLink>
      </div>
    </div>

    <div class="flex flex-wrap items-start gap-5">
      <section class="panel flex min-w-0 max-w-full flex-[0_1_auto] flex-col gap-2.5 max-sm:px-2.5">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="hd m-0 text-[17px] text-sonar-bright">Target · {{ first }}'s waters</h2>
          <span v-if="fleetKnown" class="label">{{ enemyLeft }} contacts remain</span>
        </div>
        <SonarBoard
          :cells="targetCells"
          :label="`${first}'s waters`"
          mode="target"
          size="big"
          :sweep="phase === 'salvo' || phase === 'incoming'"
          @select="(i) => emit('fire', i)"
        />
        <div class="flex flex-wrap gap-6 text-[13px] text-sonar-muted">
          <span>SHOTS {{ pad2(shots) }}</span
          ><span>HITS {{ pad2(hits) }}</span
          ><span>ACCURACY {{ accuracy }}</span>
        </div>
      </section>

      <div class="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
        <div class="flex flex-wrap gap-5">
          <section class="panel flex flex-[0_1_auto] flex-col gap-2 max-sm:px-3">
            <h2 class="hd m-0 text-[15px] text-sonar-bright">Own waters</h2>
            <SonarBoard :cells="ownCells" label="Your waters" mode="view" size="small" />
            <span v-if="lastTheirs" class="max-w-[260px] text-[13px] text-sonar-muted">{{ lastTheirs }}</span>
          </section>
          <section class="panel flex flex-[1_1_180px] flex-col gap-1">
            <h2 class="hd m-0 mb-1.5 text-[15px] text-sonar-bright">Damage report</h2>
            <span class="label">{{ first }} · {{ fleetKnown ? `${enemyLeft} afloat` : "unknown" }}</span>
            <div
              v-for="s in enemyFleet"
              :key="`e-${s.name}`"
              class="flex min-h-[26px] items-center gap-2.5 text-[13px] uppercase tracking-[0.04em]"
              :class="s.sunk ? 'text-sonar-dim line-through' : ''"
            >
              <span class="flex-1">{{ s.name }}<span v-if="s.sunk" class="sr-only"> (sunk)</span></span>
              <span class="flex gap-0.5" aria-hidden="true">
                <span
                  v-for="n in s.size"
                  :key="n"
                  class="h-2.5 w-2.5"
                  :class="s.sunk ? 'bg-[#5A3A1A]' : 'bg-sonar-edge'"
                ></span>
              </span>
            </div>
            <span class="label mt-2">You · {{ myLeft }} afloat</span>
            <div
              v-for="s in myFleet"
              :key="`m-${s.name}`"
              class="flex min-h-[26px] items-center gap-2.5 text-[13px] uppercase tracking-[0.04em]"
              :class="s.sunk ? 'text-sonar-dim line-through' : ''"
            >
              <span class="flex-1">
                {{ s.name }}<span class="sr-only">{{ s.sunk ? " (sunk)" : s.hits ? ` (${s.hits} hits)` : "" }}</span>
              </span>
              <span class="flex gap-0.5" aria-hidden="true">
                <span
                  v-for="n in s.size"
                  :key="n"
                  class="h-2.5 w-2.5"
                  :class="s.sunk ? 'bg-[#5A3A1A]' : n <= s.hits ? 'bg-sonar-amber' : 'bg-sonar-edge'"
                ></span>
              </span>
            </div>
          </section>
        </div>

        <section class="panel flex flex-col gap-2.5">
          <h2 class="hd m-0 text-[15px] text-sonar-bright">Shot log</h2>
          <p v-if="!log.length" class="m-0 text-[13px] text-sonar-muted">No shots fired yet.</p>
          <ol v-else class="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
            <li v-for="e in log" :key="e.n" class="grid grid-cols-[28px_72px_36px_minmax(0,1fr)] gap-x-2.5">
              <span class="text-sonar-dim">{{ e.n }}</span>
              <span class="truncate" :class="e.mine ? 'text-sonar-bright' : 'text-sonar-muted'">{{ e.who }}</span>
              <span class="text-sonar-bright">{{ e.at }}</span>
              <span :class="e.tone">{{ e.result }}</span>
            </li>
          </ol>
        </section>
      </div>
    </div>
  </div>
</template>
