<script setup lang="ts">
import { computed } from "vue";
import type {
  LaneLifecycle,
  OrchestratorSnapshot,
  StatusLane,
} from "../types.ts";

const props = defineProps<{
  snapshot: OrchestratorSnapshot | null;
}>();

const STATUS_LABEL: Record<LaneLifecycle, string> = {
  starting: "Starting",
  running: "Running",
  done: "Done",
  fail: "Fail",
};

const fallbackLanes: StatusLane[] = [
  {
    id: "git",
    title: "Git",
    status: "starting",
    detail: "Connecting…",
  },
  {
    id: "build",
    title: "Build",
    status: "starting",
    detail: "Connecting…",
  },
  {
    id: "nodemon",
    title: "Nodemon",
    status: "starting",
    detail: "Connecting…",
  },
];

const lanes = computed((): StatusLane[] => {
  const l = props.snapshot?.lanes;
  if (!l) return fallbackLanes;
  return [l.git, l.build, l.nodemon];
});

const readiness = computed(() => {
  if (!props.snapshot) return { label: "Connecting…", tone: "idle" as const };
  const statuses = lanes.value.map((l) => l.status);
  if (statuses.includes("fail"))
    return { label: "Something failed", tone: "bad" as const };
  if (statuses.includes("running") || statuses.includes("starting"))
    return { label: "In progress", tone: "busy" as const };
  return { label: "All systems go", tone: "live" as const };
});
</script>

<template>
  <section class="signals" :data-tone="readiness.tone" aria-label="Runtime signals">
    <header class="signals-head">
      <p class="eyebrow">Runtime</p>
      <h2 class="readiness">
        <span class="lamp" aria-hidden="true" />
        <span>{{ readiness.label }}</span>
      </h2>
    </header>

    <div class="grid">
      <article
        v-for="lane in lanes"
        :key="lane.id"
        class="signal"
        :data-status="lane.status"
        aria-live="polite"
      >
        <div class="signal-top">
          <span
            class="led"
            :class="{ pulse: lane.status === 'starting' || lane.status === 'running' }"
            :title="STATUS_LABEL[lane.status]"
            aria-hidden="true"
          />
          <span class="signal-label">{{ lane.title }}</span>
        </div>
        <p class="signal-state">{{ STATUS_LABEL[lane.status] }}</p>
        <p class="signal-meta" :title="lane.detail">{{ lane.detail }}</p>
      </article>
    </div>

    <ul class="legend" aria-label="LED legend">
      <li data-status="starting"><span class="led mini" /> Starting</li>
      <li data-status="running"><span class="led mini pulse" /> Running</li>
      <li data-status="done"><span class="led mini" /> Done</li>
      <li data-status="fail"><span class="led mini" /> Fail</li>
    </ul>
  </section>
</template>

<style scoped>
.signals {
  --ink: #10241f;
  --muted: #5c6f68;
  --panel: rgba(255, 255, 255, 0.72);
  --line: rgba(16, 36, 31, 0.12);
  --ok: #1f8a5b;
  --ok-glow: rgba(31, 138, 91, 0.45);
  --busy: #2b6cb0;
  --warn: #c99212;
  --bad: #c23b3b;
  --idle: #6b7c76;
  --led-starting: #e6a817;
  --led-running: #2b6cb0;
  --led-done: #1f8a5b;
  --led-fail: #c23b3b;

  position: relative;
  overflow: hidden;
  padding: 1.25rem 1.35rem 1.25rem;
  border-radius: 1.15rem;
  border: 1px solid var(--line);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.88), rgba(232, 244, 238, 0.7)),
    radial-gradient(120% 80% at 0% 0%, rgba(47, 158, 110, 0.14), transparent 55%);
  box-shadow: 0 18px 40px rgba(16, 36, 31, 0.08);
  animation: rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.signals::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(16, 36, 31, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(16, 36, 31, 0.035) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.55), transparent 85%);
  pointer-events: none;
}

.signals-head {
  position: relative;
  margin-bottom: 1.1rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
}

.readiness {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 0;
  font-family: "Sora", system-ui, sans-serif;
  font-size: clamp(1.25rem, 2.5vw, 1.55rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--ink);
}

.lamp {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
  background: var(--idle);
  box-shadow: 0 0 0 4px rgba(107, 124, 118, 0.15);
  flex-shrink: 0;
  transition:
    background 0.35s ease,
    box-shadow 0.35s ease;
}

.signals[data-tone="live"] .lamp {
  background: var(--ok);
  box-shadow: 0 0 0 4px rgba(31, 138, 91, 0.18), 0 0 18px var(--ok-glow);
  animation: breathe 2.4s ease-in-out infinite;
}

.signals[data-tone="busy"] .lamp {
  background: var(--busy);
  box-shadow: 0 0 0 4px rgba(43, 108, 176, 0.2), 0 0 14px rgba(43, 108, 176, 0.35);
  animation: breathe 1.4s ease-in-out infinite;
}

.signals[data-tone="bad"] .lamp {
  background: var(--bad);
  box-shadow: 0 0 0 4px rgba(194, 59, 59, 0.18);
}

.grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}

.signal {
  padding: 1rem 1.05rem;
  border-radius: 0.9rem;
  border: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(8px);
  transition:
    border-color 0.3s ease,
    background 0.3s ease;
}

.signal[data-status="starting"] {
  border-color: rgba(230, 168, 23, 0.4);
  background: linear-gradient(180deg, rgba(255, 249, 230, 0.95), rgba(255, 255, 255, 0.85));
}

.signal[data-status="running"] {
  border-color: rgba(43, 108, 176, 0.4);
  background: linear-gradient(180deg, rgba(235, 244, 255, 0.95), rgba(255, 255, 255, 0.85));
}

.signal[data-status="done"] {
  border-color: rgba(31, 138, 91, 0.35);
  background: linear-gradient(180deg, rgba(236, 253, 245, 0.95), rgba(255, 255, 255, 0.85));
}

.signal[data-status="fail"] {
  border-color: rgba(194, 59, 59, 0.4);
  background: linear-gradient(180deg, rgba(254, 240, 240, 0.95), rgba(255, 255, 255, 0.85));
}

.signal-top {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.55rem;
}

.led {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
  background: #9aa8a2;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.45);
  flex-shrink: 0;
  transition:
    background 0.3s ease,
    box-shadow 0.3s ease;
}

.signal[data-status="starting"] .led,
.legend li[data-status="starting"] .led {
  background: var(--led-starting);
  box-shadow:
    0 0 0 3px rgba(230, 168, 23, 0.22),
    0 0 10px rgba(230, 168, 23, 0.55);
}

.signal[data-status="running"] .led,
.legend li[data-status="running"] .led {
  background: var(--led-running);
  box-shadow:
    0 0 0 3px rgba(43, 108, 176, 0.22),
    0 0 10px rgba(43, 108, 176, 0.55);
}

.signal[data-status="done"] .led,
.legend li[data-status="done"] .led {
  background: var(--led-done);
  box-shadow:
    0 0 0 3px rgba(31, 138, 91, 0.18),
    0 0 8px rgba(31, 138, 91, 0.4);
}

.signal[data-status="fail"] .led,
.legend li[data-status="fail"] .led {
  background: var(--led-fail);
  box-shadow:
    0 0 0 3px rgba(194, 59, 59, 0.2),
    0 0 10px rgba(194, 59, 59, 0.45);
  animation: blink 1.1s steps(1, end) infinite;
}

.led.pulse {
  animation: breathe 1.6s ease-in-out infinite;
}

.led.mini {
  width: 0.45rem;
  height: 0.45rem;
}

.signal-label {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.signal-state {
  margin: 0;
  font-family: "Sora", system-ui, sans-serif;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--ink);
}

.signal-meta {
  margin: 0.4rem 0 0;
  font-size: 0.78rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: "JetBrains Mono", ui-monospace, monospace;
}

.legend {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1.1rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--muted);
}

.legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.18);
    opacity: 0.72;
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 720px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
