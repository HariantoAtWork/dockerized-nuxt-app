<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { api } from "./api.ts";
import ToastStack from "./components/ToastStack.vue";
import { useToast } from "./composables/useToast.ts";
import type { OrchestratorSnapshot } from "./types.ts";

const { items: toastItems, push: toast } = useToast();

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
    statusJson.value = JSON.stringify(s, null, 2);
  } catch (e) {
    ok = false;
    const msg = e instanceof Error ? e.message : String(e);
    statusError.value = msg;
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
  <div class="layout">
    <h1>Nuxt orchestrator</h1>
    <p class="lead">
      Admin UI (Vue). Mutating actions require <code>ADMIN_TOKEN</code> when set.
      Pass <code>?token=…</code> in the URL if needed.
    </p>

    <section class="card">
      <h2>Status</h2>
      <pre v-if="statusJson" class="json">{{ statusJson }}</pre>
      <p v-else-if="statusError" class="err">{{ statusError }}</p>
      <p v-else>Loading…</p>
    </section>

    <div class="actions">
      <button type="button" @click="onReload">Refresh status</button>
      <button type="button" @click="onRebuild">Rebuild</button>
      <button type="button" @click="onRestart">Restart app</button>
    </div>

    <section class="card">
      <h2>Recent logs</h2>
      <pre v-if="!logsError" class="logs">{{ logsText }}</pre>
      <p v-else class="err">{{ logsError }}</p>
    </section>

    <ToastStack :items="toastItems" />
  </div>
</template>

<style scoped>
.layout {
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  margin: 1.5rem auto;
  max-width: 52rem;
  padding: 0 1rem;
}

.lead {
  color: #52525b;
  margin-bottom: 1.25rem;
}

h1 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

h2 {
  font-size: 1.1rem;
  margin: 0 0 0.5rem;
}

code {
  background: #f4f4f5;
  padding: 0.15em 0.35em;
  border-radius: 4px;
  font-size: 0.9em;
}

.card {
  margin-bottom: 1rem;
}

.json,
.logs {
  background: #f4f4f5;
  padding: 1rem;
  border-radius: 8px;
  overflow: auto;
  font-size: 0.8rem;
  line-height: 1.4;
  margin: 0;
}

.logs {
  max-height: 24rem;
}

.err {
  color: #b91c1c;
  margin: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

button {
  font: inherit;
  padding: 0.45rem 0.9rem;
  border-radius: 6px;
  border: 1px solid #d4d4d8;
  background: #fafafa;
  cursor: pointer;
}

button:hover {
  background: #f4f4f5;
}
</style>
