<script setup lang="ts">
import { computed } from "vue";
import type { OrchestratorSnapshot } from "../types.ts";

const props = defineProps<{
  snapshot: OrchestratorSnapshot | null;
}>();

function shortSha(sha: string | null | undefined): string {
  if (!sha) return "—";
  return sha.slice(0, 7);
}

const currentSha = computed(() => shortSha(props.snapshot?.currentCommit));
const remoteSha = computed(() => shortSha(props.snapshot?.remoteCommit));

const currentMessage = computed(
  () => props.snapshot?.currentCommitMessage?.trim() || "No message",
);
const remoteMessage = computed(
  () => props.snapshot?.remoteCommitMessage?.trim() || "No message",
);

const ahead = computed(() => {
  const cur = props.snapshot?.currentCommit;
  const rem = props.snapshot?.remoteCommit;
  return Boolean(cur && rem && cur !== rem);
});

const branch = computed(() => props.snapshot?.gitBranch ?? "—");
</script>

<template>
  <section class="commits" aria-label="Git commits">
    <header class="commits-head">
      <p class="eyebrow">Deployed commit</p>
      <h2 class="title">
        <span class="mono sha" :title="snapshot?.currentCommit ?? undefined">{{
          currentSha
        }}</span>
        <span class="branch">on {{ branch }}</span>
      </h2>
      <p class="message">{{ currentMessage }}</p>
    </header>

    <p v-if="ahead" class="remote" role="status">
      Remote tip
      <span class="mono sha" :title="snapshot?.remoteCommit ?? undefined">{{
        remoteSha
      }}</span>
      — {{ remoteMessage }}
    </p>
  </section>
</template>

<style scoped>
.commits {
  --ink: #10241f;
  --muted: #5c6f68;
  --line: rgba(16, 36, 31, 0.12);
  --panel: rgba(255, 255, 255, 0.72);

  margin-bottom: 1rem;
  padding: 1.25rem 1.35rem 1.35rem;
  border-radius: 1.15rem;
  border: 1px solid var(--line);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(236, 245, 240, 0.72)),
    radial-gradient(100% 80% at 100% 0%, rgba(20, 90, 70, 0.1), transparent 55%);
  box-shadow: 0 18px 40px rgba(16, 36, 31, 0.07);
  animation: rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 0.06s;
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
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.55rem 0.75rem;
  margin: 0 0 0.55rem;
  font-family: "Sora", system-ui, sans-serif;
  font-size: clamp(1.2rem, 2.4vw, 1.45rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--ink);
}

.sha {
  font-size: 1em;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.branch {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--muted);
}

.message {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 500;
  line-height: 1.45;
  color: var(--ink);
}

.remote {
  margin: 0.95rem 0 0;
  padding-top: 0.85rem;
  border-top: 1px solid var(--line);
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--muted);
}

.mono {
  font-family: "JetBrains Mono", ui-monospace, monospace;
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
