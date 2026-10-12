<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";

export type LogsTab = "orchestrator" | "app";

const NEAR_BOTTOM_PX = 48;
const RESUME_IDLE_MS = 4_000;

const props = defineProps<{
  orchestratorText?: string;
  appText?: string;
  orchestratorError?: string | null;
  appError?: string | null;
}>();

const tab = ref<LogsTab>("orchestrator");
const logEl = ref<HTMLElement | null>(null);
const stickToBottom = ref(true);
let resumeTimer: ReturnType<typeof setTimeout> | null = null;
let ignoreScroll = false;

const activeError = computed(() =>
  tab.value === "app" ? props.appError : props.orchestratorError,
);

const activeText = computed(() =>
  tab.value === "app"
    ? (props.appText ?? "")
    : (props.orchestratorText ?? ""),
);

const emptyHint = computed(() =>
  tab.value === "app"
    ? "No app output yet — start or restart the deployed process."
    : "No orchestrator log lines yet.",
);

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
}

function clearResumeTimer() {
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
}

function scheduleResume() {
  clearResumeTimer();
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    stickToBottom.value = true;
    void scrollToBottom();
  }, RESUME_IDLE_MS);
}

async function scrollToBottom() {
  const el = logEl.value;
  if (!el || !stickToBottom.value) return;
  ignoreScroll = true;
  el.scrollTop = el.scrollHeight;
  await nextTick();
  // Second pass after layout settles with new text.
  el.scrollTop = el.scrollHeight;
  requestAnimationFrame(() => {
    ignoreScroll = false;
  });
}

function onLogScroll() {
  if (ignoreScroll) return;
  const el = logEl.value;
  if (!el) return;
  if (isNearBottom(el)) {
    stickToBottom.value = true;
    clearResumeTimer();
    return;
  }
  stickToBottom.value = false;
  scheduleResume();
}

function selectTab(next: LogsTab) {
  tab.value = next;
  stickToBottom.value = true;
  clearResumeTimer();
}

watch([activeText, tab], async () => {
  await nextTick();
  await scrollToBottom();
});

onUnmounted(() => {
  clearResumeTimer();
});
</script>

<template>
  <section class="panel logs-panel">
    <div class="logs-head">
      <h2>Recent logs</h2>
      <div class="tabs" role="tablist" aria-label="Log source">
        <button
          type="button"
          role="tab"
          class="tab"
          :class="{ active: tab === 'orchestrator' }"
          :aria-selected="tab === 'orchestrator'"
          @click="selectTab('orchestrator')"
        >
          Orchestrator
        </button>
        <button
          type="button"
          role="tab"
          class="tab"
          :class="{ active: tab === 'app' }"
          :aria-selected="tab === 'app'"
          @click="selectTab('app')"
        >
          App
        </button>
      </div>
    </div>

    <p v-if="activeError" class="err">{{ activeError }}</p>
    <div v-else-if="activeText" class="logs-wrap">
      <pre
        ref="logEl"
        class="logs"
        :data-source="tab"
        @scroll="onLogScroll"
        >{{ activeText }}</pre
      >
      <p v-if="!stickToBottom" class="paused" role="status">
        Auto-scroll paused — resumes after idle
      </p>
    </div>
    <p v-else class="muted">{{ emptyHint }}</p>
  </section>
</template>

<style scoped>
.panel {
  margin-bottom: 1rem;
  padding: 0.95rem 1.05rem;
  border-radius: 1rem;
  border: 1px solid rgba(16, 36, 31, 0.12);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
}

.logs-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem 1rem;
  margin-bottom: 0.75rem;
}

.logs-head h2 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  color: #10241f;
}

.tabs {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.2rem;
  border-radius: 0.65rem;
  background: rgba(16, 36, 31, 0.06);
}

.tab {
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 0.35rem 0.75rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: #5c6f68;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.tab:hover {
  color: #10241f;
}

.tab.active {
  background: #fff;
  color: #10241f;
  box-shadow: 0 1px 3px rgba(16, 36, 31, 0.1);
}

.logs-wrap {
  position: relative;
}

.logs {
  margin: 0;
  padding: 0.85rem;
  border-radius: 0.7rem;
  background: #10241f;
  color: #d7ebe2;
  overflow: auto;
  max-height: 24rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.logs[data-source="app"] {
  background: #0f1c2e;
  color: #d5e4f5;
}

.paused {
  margin: 0.45rem 0 0;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #8a6a20;
}

.err {
  color: #b42318;
  margin: 0;
  font-weight: 500;
}

.muted {
  margin: 0;
  color: #5c6f68;
  font-size: 0.88rem;
}
</style>
