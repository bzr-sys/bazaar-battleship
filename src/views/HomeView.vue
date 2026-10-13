<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter, useRoute } from "vue-router";

import { useBazaarStore } from "@/stores/bazaar";
import type { Engagement } from "@/stores/bazaar";
import { bzr } from "@/bazaar";
import { ago, coord, loggedShotResult, pad2, shotCount } from "@/game";

const store = useBazaarStore();
const router = useRouter();
const route = useRoute();

const now = ref(Date.now());
const clock = setInterval(() => (now.value = Date.now()), 30_000);
onUnmounted(() => clearInterval(clock));

const error = ref("");
const busy = ref<string | null>(null);
const copied = ref<string | null>(null);

async function login(): Promise<void> {
  try {
    await bzr.login();
    if (route.redirectedFrom && route.redirectedFrom.name) {
      router.push(route.redirectedFrom);
    }
  } catch (e: unknown) {
    console.log("Login failed", e);
  }
}

async function run(key: string, action: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = key;
  error.value = "";
  try {
    await action();
  } catch (e) {
    console.log(e);
    error.value = e instanceof Error ? e.message : "Something went wrong. Try again.";
  } finally {
    busy.value = null;
  }
}

function challenge() {
  bzr.social.openPopup(async (userId: string) => {
    await run("challenge", async () => {
      const id = await store.createGame(userId);
      router.push({ name: "game", params: { gameId: id } });
    });
  });
}

function openLink() {
  run("link", () => store.createLink());
}

async function copy(id: string, url: string) {
  try {
    await navigator.clipboard.writeText(url);
    copied.value = id;
    setTimeout(() => (copied.value = copied.value === id ? null : copied.value), 2000);
  } catch {
    const el = document.querySelector(`[data-link="${id}"]`);
    if (el) window.getSelection()?.selectAllChildren(el);
    error.value = "Could not copy automatically. The link is selected: press Ctrl+C (or ⌘C) to copy it.";
  }
}

function opponentName(e: Engagement) {
  return store.people[e.opponentId]?.name || "Unknown player";
}

type Row = {
  e: Engagement;
  name: string;
  handle: string;
  status: string;
  tone: "amber" | "cyan" | "muted";
  marker: "dot" | "ring" | "square" | "none";
  detail: string;
  series: string;
  action?: { label: string; primary: boolean; rematch?: boolean };
  rank: number;
};

const rows = computed<Row[]>(() =>
  store.engagements
    .map((e): Row => {
      const person = store.people[e.opponentId];
      const name = person?.name || "Unknown player";
      const first = name.split(" ")[0].toUpperCase();
      const v = e.view;
      const when = ago(e.game?.lastActive ?? e.entry.lastActive, now.value);
      const base = {
        e,
        name,
        handle: person?.handle ? `@${person.handle}` : "",
        series: v ? `${pad2(v.myScore)}–${pad2(v.theirScore)}` : "--–--",
      };
      if (e.game === null) {
        return {
          ...base,
          status: "Unavailable",
          tone: "muted",
          marker: "none",
          detail: "The host removed this game",
          rank: 4,
        };
      }
      if (e.game === undefined || !v) {
        return { ...base, status: "Loading", tone: "muted", marker: "none", detail: when, rank: 2 };
      }
      // The latest shot: theirs if it is now my turn, otherwise mine.
      let event = "";
      const theirsLast = v.myTurn || e.phase === "lost";
      const log = theirsLast ? v.theirLog : v.myLog;
      if (log.length && e.phase !== "deploy" && e.phase !== "awaiting-deploy") {
        const r = theirsLast
          ? loggedShotResult(v.myShips, v.myFleet, log, log.length - 1)
          : loggedShotResult(v.theirShips, v.theirFleet, log, log.length - 1);
        const what = r.kind === "sunk" ? `sank ${r.ship}` : r.kind;
        event = `${theirsLast ? first : "YOU"} ${coord(log[log.length - 1])} ${what}`;
      }
      const detail = [when, event].filter(Boolean).join(" · ");
      switch (e.phase) {
        case "deploy":
          return {
            ...base,
            status: "Deploy fleet",
            tone: "amber",
            marker: "ring",
            detail: [when, v.opponentSetup ? "enemy deployed" : ""].filter(Boolean).join(" · "),
            action: { label: "Deploy", primary: true },
            rank: 0,
          };
        case "salvo":
          return {
            ...base,
            status: "Your salvo",
            tone: "amber",
            marker: "dot",
            detail,
            action: { label: "Engage", primary: true },
            rank: 0,
          };
        case "awaiting-deploy":
          return {
            ...base,
            status: `Awaiting ${first}`,
            tone: "cyan",
            marker: "dot",
            detail: [when, "enemy deploying"].filter(Boolean).join(" · "),
            action: { label: "Open", primary: false },
            rank: 1,
          };
        case "incoming":
          return {
            ...base,
            status: `Awaiting ${first}`,
            tone: "cyan",
            marker: "dot",
            detail,
            action: { label: "Monitor", primary: false },
            rank: 1,
          };
        default:
          return {
            ...base,
            status: `${e.phase === "won" ? "Victory" : "Defeat"} · ${shotCount(v.myShots)} shots`,
            tone: "muted",
            marker: "square",
            detail,
            action: { label: "Rematch", primary: false, rematch: true },
            rank: 3,
          };
      }
    })
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Date.parse(b.e.game?.lastActive ?? b.e.entry.lastActive) -
          Date.parse(a.e.game?.lastActive ?? a.e.entry.lastActive),
    ),
);

const waitingOnYou = computed(() => rows.value.filter((r) => r.rank === 0).length);

const record = computed(() => {
  let wins = 0;
  let losses = 0;
  for (const e of store.engagements) {
    if (e.view) {
      wins += e.view.myScore;
      losses += e.view.theirScore;
    }
  }
  return { wins, losses, opponents: new Set(store.engagements.map((e) => e.opponentId)).size };
});

function rematch(e: Engagement) {
  run(`rematch-${e.id}`, async () => {
    await store.rematch(e);
    router.push({ name: "game", params: { gameId: e.id } });
  });
}

function hide(id: string) {
  run(`hide-${id}`, () => store.hideGame(id));
}
</script>

<template>
  <main class="mx-auto max-w-[1240px] px-4 pb-12 pt-7 sm:px-6">
    <section v-if="!store.authenticated" class="panel mx-auto mt-6 flex max-w-[720px] flex-col gap-6 p-8">
      <div class="flex flex-col gap-2">
        <span class="label">Bazaar · fleet command</span>
        <h1 class="hd m-0 text-4xl text-sonar-bright sm:text-5xl">Battleship</h1>
        <p class="m-0 max-w-[52ch] text-sonar-muted">
          The two-player classic. Challenge anyone with a Bazaar account, or send a one-time invite link. Your games
          live in your own Bazaar database.
        </p>
      </div>
      <ol class="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
        <li class="border border-sonar-line p-3"><span class="text-sonar-cyan">01</span> Deploy five ships</li>
        <li class="border border-sonar-line p-3"><span class="text-sonar-cyan">02</span> Trade salvos in turn</li>
        <li class="border border-sonar-line p-3"><span class="text-sonar-cyan">03</span> Sink their whole fleet</li>
      </ol>
      <div>
        <button class="btn-primary" @click="login()">Sign up or Log in</button>
      </div>
    </section>

    <div v-else class="flex flex-wrap items-start gap-6">
      <section class="panel flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">
        <div class="flex flex-wrap items-baseline gap-4">
          <h1 class="hd m-0 text-[22px] text-sonar-bright">Engagements</h1>
          <span v-if="waitingOnYou" class="text-sonar-amber">{{ waitingOnYou }} awaiting your orders</span>
        </div>

        <p v-if="!rows.length" class="m-0 py-6 text-sonar-muted">
          No engagements yet. Challenge a player or open an invite link to start one.
        </p>
        <ul v-else class="m-0 list-none p-0">
          <li
            class="label hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_72px_minmax(0,1.3fr)_196px] gap-3 border-b border-sonar-line px-3 py-2.5 md:grid"
            aria-hidden="true"
          >
            <span>Opponent</span><span>Status</span><span>Series</span><span>Last contact</span><span></span>
          </li>
          <li
            v-for="row in rows"
            :key="row.e.id"
            class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-sonar-grid px-3 py-3 hover:bg-sonar-raised md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_72px_minmax(0,1.3fr)_196px]"
          >
            <div class="flex min-w-0 flex-col">
              <span class="truncate font-semibold text-sonar-bright">{{ row.name }}</span>
              <span class="text-xs text-sonar-dim">{{ row.handle }}</span>
            </div>
            <span
              class="order-3 inline-flex items-center gap-2 uppercase md:order-none"
              :class="{
                'text-sonar-amber': row.tone === 'amber',
                'text-sonar-cyan': row.tone === 'cyan',
                'text-sonar-muted': row.tone === 'muted',
              }"
            >
              <span
                v-if="row.marker === 'dot'"
                class="h-2 w-2 rounded-full"
                :class="row.tone === 'amber' ? 'bg-sonar-amber shadow-[0_0_8px_#FFB347]' : 'bg-sonar-edge'"
              ></span>
              <span v-else-if="row.marker === 'ring'" class="h-2 w-2 rounded-full border-2 border-sonar-amber"></span>
              <span v-else-if="row.marker === 'square'" class="h-2 w-2 bg-sonar-muted"></span>
              {{ row.status }}
            </span>
            <span class="order-4 text-sonar-bright md:order-none" :aria-label="`Series ${row.series}`">
              <span class="label md:hidden">Series </span>{{ row.series }}
            </span>
            <span class="order-5 col-span-2 text-sonar-muted md:order-none md:col-span-1">{{ row.detail }}</span>
            <div class="order-2 flex items-center justify-end gap-1 md:order-none">
              <template v-if="row.action">
                <button v-if="row.action.rematch" class="btn-outline" :disabled="busy !== null" @click="rematch(row.e)">
                  {{ busy === `rematch-${row.e.id}` ? "Starting…" : row.action.label }}
                </button>
                <RouterLink
                  v-else
                  :to="{ name: 'game', params: { gameId: row.e.id } }"
                  :class="row.action.primary ? 'btn-amber' : 'btn-outline'"
                >
                  {{ row.action.label }}
                </RouterLink>
              </template>
              <button
                class="icon-btn"
                :aria-label="`Hide game with ${opponentName(row.e)}`"
                title="Hide"
                :disabled="busy !== null"
                @click="hide(row.e.id)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14"></path>
                </svg>
              </button>
            </div>
          </li>
        </ul>
        <p v-if="error" role="alert" class="m-0 text-sonar-flare-text">{{ error }}</p>
      </section>

      <aside class="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
        <section class="panel flex flex-col gap-3.5">
          <h2 class="hd m-0 text-[17px] text-sonar-bright">New engagement</h2>
          <button class="btn-primary" :disabled="busy !== null" @click="challenge()">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8"></circle>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path>
            </svg>
            {{ busy === "challenge" ? "Creating…" : "Challenge a player" }}
          </button>
          <button class="btn-outline" :disabled="busy !== null" @click="openLink()">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"></path>
              <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"></path>
            </svg>
            {{ busy === "link" ? "Opening…" : "Open an invite link" }}
          </button>
          <p class="m-0 text-[13px] text-sonar-muted">A link admits one opponent. It closes once someone joins.</p>
        </section>

        <section v-if="store.links.length" class="panel flex flex-col gap-3">
          <h2 class="hd m-0 text-[17px] text-sonar-bright">Open links · {{ store.links.length }}</h2>
          <div v-for="link in store.links" :key="link.id" class="flex flex-col gap-1.5">
            <div
              class="flex items-center gap-2.5 border border-dashed border-sonar-edge bg-sonar-bg py-1.5 pl-3 pr-1.5"
            >
              <span class="min-w-0 flex-1 truncate text-sonar-bright" :data-link="link.id">{{
                link.linkUrl || "Generating link…"
              }}</span>
              <button
                class="btn-outline min-h-[36px] px-3"
                :disabled="!link.linkUrl"
                :aria-label="`Copy invite link ${link.linkUrl ?? ''}`"
                @click="copy(link.id, link.linkUrl)"
              >
                {{ copied === link.id ? "Copied" : "Copy" }}
              </button>
              <button
                class="icon-btn h-9 w-9"
                aria-label="Hide invite link"
                title="Hide"
                :disabled="busy !== null"
                @click="hide(link.id)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14"></path>
                </svg>
              </button>
            </div>
            <span class="text-[13px] text-sonar-muted"
              >No one has joined yet · opened {{ ago(link.lastActive, now) }}</span
            >
          </div>
        </section>

        <section class="panel grid grid-cols-3 gap-2">
          <div class="flex flex-col">
            <span class="hd text-[26px] text-sonar-bright">{{ pad2(record.wins) }}</span>
            <span class="label">Wins</span>
          </div>
          <div class="flex flex-col">
            <span class="hd text-[26px] text-sonar-bright">{{ pad2(record.losses) }}</span>
            <span class="label">Losses</span>
          </div>
          <div class="flex flex-col">
            <span class="hd text-[26px] text-sonar-bright">{{ pad2(record.opponents) }}</span>
            <span class="label">Opponents</span>
          </div>
        </section>
      </aside>
    </div>
  </main>
</template>
