<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import SonarBoard from "@/components/SonarBoard.vue";
import type { BoardCell } from "@/components/SonarBoard.vue";
import { SHIPS, SIZE, coord, randomFleet, shipCells } from "@/game";
import type { Orientation } from "@/game";

const props = defineProps<{
  opponentName: string;
  opponentReady: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{ lock: [fleet: number[][]] }>();

const placed = ref<(number[] | null)[]>(SHIPS.map(() => null));
const selected = ref<number | null>(0);
const orient = ref<Orientation>("h");
const hover = ref<number | null>(null);

const remaining = computed(() => placed.value.filter((p) => !p).length);

const preview = computed(() => {
  if (selected.value === null || hover.value === null) return null;
  const size = SHIPS[selected.value].size;
  const r = Math.floor(hover.value / SIZE);
  const c = hover.value % SIZE;
  const cells = shipCells(size, r, c, orient.value);
  const taken = new Set(placed.value.flatMap((p, k) => (p && k !== selected.value ? p : [])));
  if (cells) return { cells, ok: !cells.some((i) => taken.has(i)) };
  // Off the edge: show the part that fits, as blocked.
  const inside = Array.from({ length: size }, (_, k) => (orient.value === "h" ? [r, c + k] : [r + k, c]))
    .filter(([rr, cc]) => rr < SIZE && cc < SIZE)
    .map(([rr, cc]) => rr * SIZE + cc);
  return { cells: inside, ok: false };
});

const cells = computed<BoardCell[]>(() => {
  const owner = new Map<number, number>();
  placed.value.forEach((p, k) => p?.forEach((i) => owner.set(i, k)));
  const pv = new Set(preview.value?.cells ?? []);
  return Array.from({ length: SIZE * SIZE }, (_, i) => {
    if (pv.has(i)) {
      const ok = preview.value!.ok;
      return {
        cls: `place ${ok ? "fits" : "blocked"}`,
        label: `${coord(i)}, ${ok ? "ship fits here" : "ship does not fit"}`,
      };
    }
    const k = owner.get(i);
    if (k !== undefined) return { cls: "place ship", label: `${coord(i)}, ${SHIPS[k].name}` };
    return { cls: "place", label: `${coord(i)}, empty` };
  });
});

function place(i: number) {
  hover.value = i;
  const pv = preview.value;
  if (selected.value === null || !pv || !pv.ok) return;
  const next = [...placed.value];
  next[selected.value] = pv.cells;
  placed.value = next;
  const free = next.findIndex((p) => !p);
  selected.value = free >= 0 ? free : null;
}

function pick(k: number) {
  if (placed.value[k]) {
    const next = [...placed.value];
    next[k] = null;
    placed.value = next;
  }
  selected.value = k;
}

function rotate() {
  orient.value = orient.value === "h" ? "v" : "h";
}

function shuffle() {
  placed.value = randomFleet();
  selected.value = null;
}

function clear() {
  placed.value = SHIPS.map(() => null);
  selected.value = 0;
}

function lock() {
  if (remaining.value || props.busy) return;
  emit("lock", placed.value as number[][]);
}

function onKey(e: KeyboardEvent) {
  if ((e.key === "r" || e.key === "R") && !(e.target instanceof HTMLInputElement) && !e.metaKey && !e.ctrlKey) {
    rotate();
  }
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));

const status = (k: number) => (selected.value === k ? "Armed" : placed.value[k] ? "Deployed" : "In port");
</script>

<template>
  <div class="flex flex-wrap items-start gap-6">
    <section class="panel flex flex-[1_1_280px] flex-col gap-2.5">
      <h2 class="hd m-0 mb-1 text-[17px] text-sonar-bright">Manifest</h2>
      <button
        v-for="(ship, k) in SHIPS"
        :key="ship.id"
        type="button"
        class="flex min-h-[52px] w-full items-center gap-3 border px-3 py-2 text-left"
        :class="
          selected === k
            ? 'border-sonar-cyan bg-[#0A2A38] text-sonar-bright'
            : placed[k]
              ? 'border-sonar-line bg-sonar-bg text-sonar-dim hover:border-sonar-edge'
              : 'border-sonar-line bg-sonar-bg hover:border-sonar-edge'
        "
        :aria-pressed="selected === k"
        @click="pick(k)"
      >
        <span class="flex-1 uppercase tracking-[0.06em]">{{ ship.name }}</span>
        <span class="flex gap-[3px]" aria-hidden="true">
          <span
            v-for="n in ship.size"
            :key="n"
            class="h-3 w-3"
            :class="
              selected === k ? 'bg-sonar-cyan shadow-[0_0_6px_#46E3D2]' : placed[k] ? 'bg-sonar-line' : 'bg-sonar-edge'
            "
          ></span>
        </span>
        <span class="w-[76px] text-right text-xs uppercase tracking-[0.08em]">{{ status(k) }}</span>
      </button>
      <p class="m-0 mt-1.5 text-[13px] text-sonar-muted">
        Select a ship, then the square for its bow. <kbd>R</kbd> or Rotate turns it. Select a deployed ship to move it.
      </p>
    </section>

    <section class="panel flex min-w-0 max-w-full flex-[0_1_auto] flex-col gap-3">
      <div class="flex items-baseline justify-between gap-3">
        <h1 class="hd m-0 text-[22px] text-sonar-bright">Deploy fleet</h1>
        <span class="tracking-[0.08em] text-sonar-cyan">HEADING · {{ orient === "h" ? "EAST" : "SOUTH" }}</span>
      </div>
      <SonarBoard
        :cells="cells"
        label="Your waters"
        mode="place"
        size="big"
        @select="place"
        @hover="(i) => (hover = i)"
        @leave="hover = null"
      />
      <div class="flex flex-wrap gap-2">
        <button class="btn-outline" @click="rotate()">Rotate</button>
        <button class="btn-outline" @click="shuffle()">Auto-deploy</button>
        <button class="btn-outline" @click="clear()">Recall all</button>
      </div>
    </section>

    <aside class="panel flex flex-[1_1_240px] flex-col gap-3.5">
      <h2 class="hd m-0 text-[17px] text-sonar-bright">Readiness</h2>
      <div class="flex flex-col gap-1.5">
        <span class="flex justify-between gap-3">
          <span class="text-sonar-dim">YOU</span>
          <span class="text-sonar-amber">{{ remaining ? `${remaining} in port` : "All deployed" }}</span>
        </span>
        <span class="flex justify-between gap-3">
          <span class="truncate uppercase text-sonar-dim">{{ opponentName }}</span>
          <span :class="opponentReady ? 'text-sonar-cyan' : 'text-sonar-muted'">
            {{ opponentReady ? "Deployed" : "Deploying" }}
          </span>
        </span>
      </div>
      <button class="btn-amber" :disabled="remaining > 0 || busy" @click="lock()">
        {{ busy ? "Locking in…" : "Lock in fleet" }}
      </button>
      <p class="m-0 text-[13px] text-sonar-muted">Once locked in, ships can't move until the next game.</p>
    </aside>
  </div>
</template>
