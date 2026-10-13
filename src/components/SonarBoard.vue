<script setup lang="ts">
import { ref } from "vue";
import { COLS, ROWS, SIZE } from "@/game";

export type BoardCell = { cls: string; label: string; disabled?: boolean };

const props = defineProps<{
  cells: BoardCell[];
  label: string;
  /** target: fire at squares; place: position ships; view: read only. */
  mode: "target" | "place" | "view";
  size: "big" | "small";
  sweep?: boolean;
}>();

const emit = defineEmits<{
  select: [index: number];
  hover: [index: number];
  leave: [];
}>();

// One square is in the tab order; arrow keys move between squares.
const focusIndex = ref(0);
const buttons = ref<HTMLButtonElement[]>([]);

function move(i: number) {
  focusIndex.value = i;
  buttons.value.find((b) => Number(b.dataset.i) === i)?.focus();
}

function onKeydown(e: KeyboardEvent) {
  const i = focusIndex.value;
  const r = Math.floor(i / SIZE);
  const c = i % SIZE;
  const keys: Record<string, number> = {
    ArrowUp: r > 0 ? i - SIZE : i,
    ArrowDown: r < SIZE - 1 ? i + SIZE : i,
    ArrowLeft: c > 0 ? i - 1 : i,
    ArrowRight: c < SIZE - 1 ? i + 1 : i,
    Home: r * SIZE,
    End: r * SIZE + SIZE - 1,
  };
  if (e.key in keys) {
    e.preventDefault();
    move(keys[e.key]);
  }
}

function onFocus(i: number) {
  focusIndex.value = i;
  emit("hover", i);
}
</script>

<template>
  <div class="board" :class="size" role="group" :aria-label="props.label" @mouseleave="emit('leave')">
    <div class="flex" aria-hidden="true">
      <span class="lab"></span>
      <span v-for="n in COLS" :key="n" class="colh">{{ n }}</span>
    </div>
    <div v-for="(row, r) in ROWS" :key="row" class="flex">
      <span class="lab" aria-hidden="true">{{ row }}</span>
      <template v-for="c in SIZE" :key="c">
        <span
          v-if="mode === 'view'"
          class="cell"
          :class="cells[r * SIZE + c - 1]?.cls"
          role="img"
          :aria-label="cells[r * SIZE + c - 1]?.label"
        ></span>
        <button
          v-else
          ref="buttons"
          type="button"
          class="cell"
          :class="cells[r * SIZE + c - 1]?.cls"
          :data-i="r * SIZE + c - 1"
          :aria-label="cells[r * SIZE + c - 1]?.label"
          :aria-disabled="cells[r * SIZE + c - 1]?.disabled || undefined"
          :tabindex="focusIndex === r * SIZE + c - 1 ? 0 : -1"
          @click="!cells[r * SIZE + c - 1]?.disabled && emit('select', r * SIZE + c - 1)"
          @mouseenter="emit('hover', r * SIZE + c - 1)"
          @focus="onFocus(r * SIZE + c - 1)"
          @keydown="onKeydown"
        ></button>
      </template>
    </div>
    <div v-if="sweep" class="sweep" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.board {
  position: relative;
  overflow: hidden;
  width: max-content;
  --label: calc(var(--cell) * 0.62);
}
.big {
  --cell: min(42px, calc((100vw - 64px) / 10.7));
}
.small {
  --cell: 22px;
}
@media (max-width: 640px) {
  .small {
    --cell: 14px;
  }
}
.lab,
.colh {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5fa9a1;
  font-size: max(9px, calc(var(--cell) * 0.3));
}
.lab {
  width: var(--label);
  height: var(--cell);
}
.colh {
  width: var(--cell);
  height: var(--label);
}
.board .flex:first-child .lab {
  height: var(--label);
}
.sweep {
  left: var(--label);
  top: var(--label);
  width: calc(var(--cell) * 10);
  height: calc(var(--cell) * 10);
}
</style>
