<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { api } from "./api.ts";
import RuntimeSignals from "./components/RuntimeSignals.vue";
import ToastStack from "./components/ToastStack.vue";
import { useToast } from "./composables/useToast.ts";
import type { OrchestratorSnapshot } from "./types.ts";

const { items: toastItems, push: toast } = useToast();

const snapshot = ref<OrchestratorSnapshot | null>(null);
const statusJson = ref<string | null>(null);
const statusError = ref<string | null>(null);
const logsText = ref<string>("");
const logsError = ref<string | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function refresh(opts?: { silent?: boolean }) {
  const silent = opts?.silent ?? false;
  let ok = true;
  statusError.value = null;
  logsError.value = null;
  try {
    const s = await api<OrchestratorSnapshot>("/api/status");
    snapshot.value = s;
    statusJson.value = JSON.stringify(s, null, 2);
  } catch (e) {
    ok = false;
    const msg = e instanceof Error ? e.message : String(e);
    statusError.value = msg;
    snapshot.value = null;
    statusJson.value = null;
    if (!silent) toast(msg, "error");
  }
  try {
    const l = await api<{ lines: string[] }>("/api/logs?n=120");
    logsText.value = l.lines.join("\n");
  } catch (e) {
    ok = false;
    logsError.value = e instanceof Error ? e.message : String(e);
  }
  return ok;
}

async function onReload() {
  if (await refresh({})) toast("Status refreshed", "success");
}

async function onRebuild() {
  try {
    await api("/api/rebuild", { method: "POST" });
    toast("Rebuild finished", "success");
    await refresh({});
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), "error");
  }
}

async function onRestart() {
  try {
    await api("/api/restart-app", { method: "POST" });
    toast("App restarted", "success");
    await refresh({});
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), "error");
  }
}

onMounted(() => {
  void refresh({});
  pollTimer = setInterval(() => {
    void refresh({ silent: true });
  }, 10_000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <div class="shell">
    <div class="layout">
      <header class="hero">
        <p class="brand">Nuxt orchestrator</p>
        <p class="lead">
          Watch build output and nodemon at a glance. Mutating actions need
          <code>ADMIN_TOKEN</code> when set — pass <code>?token=…</code> if required.
        </p>
      </header>

      <RuntimeSignals :snapshot="snapshot" />

      <p v-if="statusError" class="err banner">{{ statusError }}</p>

      <div class="actions">
        <button type="button" class="btn" @click="onReload">Refresh</button>
        <button type="button" class="btn btn-primary" @click="onRebuild">
          Rebuild
        </button>
        <button type="button" class="btn" @click="onRestart">Restart app</button>
      </div>

      <details class="panel">
        <summary>Full status payload</summary>
        <pre v-if="statusJson" class="json">{{ statusJson }}</pre>
        <p v-else-if="statusError" class="err">{{ statusError }}</p>
        <p v-else class="muted">Loading…</p>
      </details>

      <section class="panel logs-panel">
        <h2>Recent logs</h2>
        <pre v-if="!logsError" class="logs">{{ logsText }}</pre>
        <p v-else class="err">{{ logsError }}</p>
      </section>

      <ToastStack :items="toastItems" />
    </div>
  </div>
</template>

<style scoped>
.shell {
  --ink: #10241f;
  --muted: #5c6f68;
  --line: rgba(16, 36, 31, 0.12);
  --bg0: #e8f2ec;
  --bg1: #f7faf8;
  --surface: rgba(255, 255, 255, 0.78);

  min-height: 100vh;
  color: var(--ink);
  background:
    radial-gradient(90% 60% at 10% -10%, rgba(47, 158, 110, 0.22), transparent 50%),
    radial-gradient(70% 50% at 100% 0%, rgba(20, 90, 70, 0.12), transparent 45%),
    linear-gradient(180deg, var(--bg0), var(--bg1) 40%, #eef4f0);
  font-family: "Sora", system-ui, sans-serif;
}

.layout {
  margin: 0 auto;
  max-width: 44rem;
  padding: 2rem 1.1rem 3rem;
}

.hero {
  margin-bottom: 1.35rem;
  animation: rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.brand {
  margin: 0 0 0.55rem;
  font-size: clamp(1.85rem, 4vw, 2.35rem);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 1.1;
}

.lead {
  margin: 0;
  max-width: 36rem;
  color: var(--muted);
  font-size: 0.98rem;
  line-height: 1.55;
  font-weight: 500;
}

code {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.86em;
  background: rgba(16, 36, 31, 0.06);
  padding: 0.12em 0.35em;
  border-radius: 0.35rem;
}

.banner {
  margin: 0.85rem 0 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin: 1.15rem 0 1.25rem;
}

.btn {
  font: inherit;
  font-size: 0.92rem;
  font-weight: 600;
  padding: 0.55rem 1rem;
  border-radius: 0.65rem;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  transition:
    background 0.2s ease,
    transform 0.2s ease,
    border-color 0.2s ease;
}

.btn:hover {
  background: #fff;
  transform: translateY(-1px);
}

.btn-primary {
  background: #16352c;
  border-color: #16352c;
  color: #f3faf6;
}

.btn-primary:hover {
  background: #1f4a3d;
  border-color: #1f4a3d;
}

.panel {
  margin-bottom: 1rem;
  padding: 0.95rem 1.05rem;
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: var(--surface);
  backdrop-filter: blur(8px);
}

.panel summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--ink);
  list-style: none;
}

.panel summary::-webkit-details-marker {
  display: none;
}

.panel[open] summary {
  margin-bottom: 0.65rem;
}

.logs-panel h2 {
  margin: 0 0 0.65rem;
  font-size: 0.92rem;
  font-weight: 600;
}

.json,
.logs {
  margin: 0;
  padding: 0.85rem;
  border-radius: 0.7rem;
  background: #10241f;
  color: #d7ebe2;
  overflow: auto;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.45;
}

.logs {
  max-height: 24rem;
}

.err {
  color: #b42318;
  margin: 0;
  font-weight: 500;
}

.muted {
  margin: 0;
  color: var(--muted);
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
