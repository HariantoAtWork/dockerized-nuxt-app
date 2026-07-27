<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { api } from "../api.ts";

const props = defineProps<{
  currentBranch: string | null;
  busy?: boolean;
}>();

const emit = defineEmits<{
  switched: [];
  error: [message: string];
}>();

const branches = ref<string[]>([]);
const selected = ref("");
const loadingList = ref(false);
const switching = ref(false);
const listError = ref<string | null>(null);

const disabled = computed(
  () => props.busy === true || switching.value || loadingList.value,
);

const canSwitch = computed(() => {
  const next = selected.value.trim();
  return Boolean(next) && next !== props.currentBranch && !disabled.value;
});

async function loadBranches() {
  loadingList.value = true;
  listError.value = null;
  try {
    const data = await api<{ current: string; branches: string[] }>(
      "/api/branches",
    );
    branches.value = data.branches;
    if (!selected.value) selected.value = data.current;
  } catch (e) {
    listError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loadingList.value = false;
  }
}

async function onSwitch() {
  if (!canSwitch.value) return;
  switching.value = true;
  try {
    await api("/api/branch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ branch: selected.value.trim() }),
    });
    emit("switched");
    await loadBranches();
  } catch (e) {
    emit("error", e instanceof Error ? e.message : String(e));
  } finally {
    switching.value = false;
  }
}

watch(
  () => props.currentBranch,
  (b) => {
    if (b) selected.value = b;
  },
);

onMounted(() => {
  void loadBranches();
});
</script>

<template>
  <section class="branch" aria-label="Git branch">
    <header class="branch-head">
      <p class="eyebrow">Deploy branch</p>
      <h2 class="title">Live checkout</h2>
      <p class="hint">
        Switch remote branch, rebuild, and put it live for testing.
      </p>
    </header>

    <div class="row">
      <label class="field">
        <span class="field-label">Branch</span>
        <select
          v-model="selected"
          class="select"
          :disabled="disabled || branches.length === 0"
        >
          <option v-if="branches.length === 0" value="">
            {{ loadingList ? "Loading…" : "No branches" }}
          </option>
          <option v-for="b in branches" :key="b" :value="b">{{ b }}</option>
        </select>
      </label>

      <button
        type="button"
        class="go"
        :disabled="!canSwitch"
        @click="onSwitch"
      >
        {{ switching ? "Deploying…" : "Switch & rebuild" }}
      </button>

      <button
        type="button"
        class="refresh"
        :disabled="disabled"
        title="Refresh remote branches"
        @click="loadBranches"
      >
        Refresh list
      </button>
    </div>

    <p v-if="props.currentBranch" class="current mono">
      Active: <strong>{{ props.currentBranch }}</strong>
    </p>
    <p v-if="listError" class="err">{{ listError }}</p>
    <p v-if="switching" class="busy">
      Fetching branch, rebuilding, and restarting the app — this can take a while.
    </p>
  </section>
</template>

<style scoped>
.branch {
  --ink: #10241f;
  --muted: #5c6f68;
  --line: rgba(16, 36, 31, 0.12);
  margin: 1rem 0 0;
  padding: 1.25rem 1.35rem 1.35rem;
  border-radius: 1.15rem;
  border: 1px solid var(--line);
  background:
    linear-gradient(155deg, rgba(255, 255, 255, 0.9), rgba(236, 245, 240, 0.75)),
    radial-gradient(100% 80% at 100% 0%, rgba(22, 53, 44, 0.08), transparent 55%);
  box-shadow: 0 18px 40px rgba(16, 36, 31, 0.07);
  animation: rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
}

.branch-head {
  margin-bottom: 1rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
}

.title {
  margin: 0;
  font-family: "Sora", system-ui, sans-serif;
  font-size: clamp(1.2rem, 2.4vw, 1.45rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--ink);
}

.hint {
  margin: 0.4rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.45;
  font-weight: 500;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1 1 12rem;
  min-width: 10rem;
}

.field-label {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--muted);
}

.select {
  font: inherit;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.88rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.65rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink);
}

.go,
.refresh {
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.6rem 1rem;
  border-radius: 0.65rem;
  cursor: pointer;
  border: 1px solid var(--line);
  transition:
    background 0.2s ease,
    transform 0.2s ease,
    opacity 0.2s ease;
}

.go {
  background: #16352c;
  border-color: #16352c;
  color: #f3faf6;
}

.go:hover:not(:disabled) {
  background: #1f4a3d;
  transform: translateY(-1px);
}

.refresh {
  background: rgba(255, 255, 255, 0.85);
  color: var(--ink);
}

.refresh:hover:not(:disabled) {
  background: #fff;
}

.go:disabled,
.refresh:disabled,
.select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.current {
  margin: 0.85rem 0 0;
  font-size: 0.82rem;
  color: var(--muted);
}

.mono {
  font-family: "JetBrains Mono", ui-monospace, monospace;
}

.err {
  margin: 0.65rem 0 0;
  color: #b42318;
  font-weight: 500;
  font-size: 0.9rem;
}

.busy {
  margin: 0.65rem 0 0;
  color: #8a6a1f;
  font-size: 0.88rem;
  font-weight: 500;
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
</style>
