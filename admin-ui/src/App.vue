<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { api } from "./api.ts";
import BranchSwitcher from "./components/BranchSwitcher.vue";
import CommitStatus from "./components/CommitStatus.vue";
import GitGraphPanel from "./components/GitGraphPanel.vue";
import RuntimeSignals from "./components/RuntimeSignals.vue";
import ToastStack from "./components/ToastStack.vue";
import { useToast } from "./composables/useToast.ts";
import type { GitGraphRow, OrchestratorSnapshot } from "./types.ts";

const { items: toastItems, push: toast } = useToast();

const snapshot = ref<OrchestratorSnapshot | null>(null);
const statusJson = ref<string | null>(null);
const statusError = ref<string | null>(null);
const logsText = ref<string>("");
const logsError = ref<string | null>(null);
const gitGraphRows = ref<GitGraphRow[]>([]);
const gitGraphError = ref<string | null>(null);
const gitGraphLoading = ref(true);
const actionBusy = ref(false);

const currentBranch = computed(() => snapshot.value?.gitBranch ?? null);
const phaseBusy = computed(() => {
  const p = snapshot.value?.phase;
  return p === "building" || p === "syncing";
});

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
  try {
    const g = await api<{ rows: GitGraphRow[] }>("/api/git-graph?n=35");
    gitGraphRows.value = g.rows;
    gitGraphError.value = null;
  } catch (e) {
    ok = false;
    gitGraphError.value = e instanceof Error ? e.message : String(e);
    gitGraphRows.value = [];
  } finally {
    gitGraphLoading.value = false;
  }
  return ok;
}

async function onReload() {
  if (await refresh({})) toast("Status refreshed", "success");
}

async function onRebuild() {
  actionBusy.value = true;
  try {
    await api("/api/rebuild", { method: "POST" });
    toast("Rebuild finished", "success");
    await refresh({});
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), "error");
  } finally {
    actionBusy.value = false;
  }
}

async function onRestart() {
  actionBusy.value = true;
  try {
    await api("/api/restart-app", { method: "POST" });
    toast("App restarted", "success");
    await refresh({});
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), "error");
  } finally {
    actionBusy.value = false;
  }
}

async function onBranchSwitched() {
  toast("Branch deployed live; pin cleared", "success");
  await refresh({});
}

async function onDeployCommit(hash: string) {
  actionBusy.value = true;
  try {
    await api("/api/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commit: hash }),
    });
    toast("Commit deployed live", "success");
    await refresh({});
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), "error");
  } finally {
    actionBusy.value = false;
  }
}

async function onUnpinCommit() {
  actionBusy.value = true;
  try {
    await api("/api/commit/unpin", { method: "POST" });
    toast("Unpinned; branch tip deployed", "success");
    await refresh({});
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), "error");
  } finally {
    actionBusy.value = false;
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
      <div class="grid">
        <section>
          <header class="hero">
            <p class="brand">Nuxt orchestrator</p>
            <p class="lead">
              Switch git branches, rebuild, and watch runtime health. Mutating
              actions need <code>ADMIN_TOKEN</code> when set — pass
              <code>?token=…</code> if required.
            </p>
          </header>

          <RuntimeSignals :snapshot="snapshot" />

          <CommitStatus
            :snapshot="snapshot"
            :busy="actionBusy || phaseBusy"
            @unpin="onUnpinCommit"
          />

          <BranchSwitcher
            :current-branch="currentBranch"
            :pinned="Boolean(snapshot?.pinnedCommit)"
            :busy="actionBusy || phaseBusy"
            @switched="onBranchSwitched"
            @error="(msg) => toast(msg, 'error')"
          />

          <p v-if="statusError" class="err banner">{{ statusError }}</p>

          <div class="actions">
            <button
              type="button"
              class="btn"
              :disabled="actionBusy"
              @click="onReload"
            >
              Refresh
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="actionBusy"
              @click="onRebuild"
            >
              Rebuild
            </button>
            <button
              type="button"
              class="btn"
              :disabled="actionBusy"
              @click="onRestart"
            >
              Restart app
            </button>
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
        </section>

        <aside class="side-panel">
          <GitGraphPanel
            :rows="gitGraphRows"
            :current-commit="snapshot?.currentCommit ?? null"
            :remote-commit="snapshot?.remoteCommit ?? null"
            :pinned-commit="snapshot?.pinnedCommit ?? null"
            :busy="actionBusy || phaseBusy"
            :error="gitGraphError"
            :loading="gitGraphLoading"
            @deploy-commit="onDeployCommit"
            @unpin="onUnpinCommit"
          />
        </aside>
      </div>

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
  max-width: 76rem;
  padding: 2rem 1.1rem 3rem;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem 1.2rem;
}

.side-panel {
  min-width: 0;
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

.btn:hover:not(:disabled) {
  background: #fff;
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-primary {
  background: #16352c;
  border-color: #16352c;
  color: #f3faf6;
}

.btn-primary:hover:not(:disabled) {
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

@media (min-width: 1120px) {
  .grid {
    grid-template-columns: minmax(0, 1fr) minmax(22rem, 28rem);
    align-items: start;
  }

  .side-panel {
    position: sticky;
    top: 1rem;
  }
}
</style>
