<script setup lang="ts">
import { computed } from "vue";
import type { OrchestratorSnapshot } from "../types.ts";

const props = defineProps<{
  snapshot: OrchestratorSnapshot | null;
}>();

const entryOk = computed(() => props.snapshot?.serverEntryExists === true);
const nodemonOk = computed(() => props.snapshot?.appRunning === true);

const readiness = computed(() => {
  if (!props.snapshot) return { label: "Connecting…", tone: "idle" as const };
  if (entryOk.value && nodemonOk.value)
    return { label: "Runtime live", tone: "live" as const };
  if (entryOk.value && !nodemonOk.value)
    return { label: "Build ready — app stopped", tone: "warn" as const };
  if (!entryOk.value && nodemonOk.value)
    return { label: "Process up — entry missing", tone: "bad" as const };
  return { label: "Waiting for build output", tone: "idle" as const };
});

const entryPath = computed(
  () => props.snapshot?.serverEntryPath ?? ".output/server/index.mjs",
);

const pidLabel = computed(() => {
  const pid = props.snapshot?.appPid;
  return pid != null ? `pid ${pid}` : "no process";
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
        class="signal"
        :class="entryOk ? 'is-ok' : 'is-off'"
        aria-live="polite"
      >
        <div class="signal-top">
          <span class="signal-dot" aria-hidden="true" />
          <span class="signal-label">Build entry</span>
        </div>
        <p class="signal-state">
          {{ entryOk ? "Present" : "Missing" }}
        </p>
        <p class="signal-meta mono" :title="entryPath">{{ entryPath }}</p>
      </article>

      <article
        class="signal"
        :class="nodemonOk ? 'is-ok' : 'is-off'"
        aria-live="polite"
      >
        <div class="signal-top">
          <span class="signal-dot" :class="{ pulse: nodemonOk }" aria-hidden="true" />
          <span class="signal-label">Nodemon</span>
        </div>
        <p class="signal-state">
          {{ nodemonOk ? "Running" : "Stopped" }}
        </p>
        <p class="signal-meta mono">{{ pidLabel }}</p>
      </article>
    </div>
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
  --warn: #b7791f;
  --bad: #c23b3b;
  --idle: #6b7c76;

  position: relative;
  overflow: hidden;
  padding: 1.25rem 1.35rem 1.4rem;
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

.signals[data-tone="warn"] .lamp {
  background: var(--warn);
  box-shadow: 0 0 0 4px rgba(183, 121, 31, 0.18);
}

.signals[data-tone="bad"] .lamp {
  background: var(--bad);
  box-shadow: 0 0 0 4px rgba(194, 59, 59, 0.18);
}

.grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
    transform 0.3s ease,
    background 0.3s ease;
}

.signal.is-ok {
  border-color: rgba(31, 138, 91, 0.35);
  background: linear-gradient(180deg, rgba(236, 253, 245, 0.95), rgba(255, 255, 255, 0.85));
}

.signal.is-off {
  border-color: rgba(16, 36, 31, 0.1);
}

.signal-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.55rem;
}

.signal-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: #9aa8a2;
  transition: background 0.3s ease;
}

.signal.is-ok .signal-dot {
  background: var(--ok);
}

.signal-dot.pulse {
  animation: breathe 2s ease-in-out infinite;
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
}

.mono {
  font-family: "JetBrains Mono", ui-monospace, monospace;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.75;
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

@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
