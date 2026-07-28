<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { GitGraphCommit, GitGraphRow } from "../types.ts";
import {
  buildGitGraphLayout,
  STROKE,
  TITLE_NODE_OFFSET,
} from "../utils/gitGraphLayout.ts";

const props = defineProps<{
  rows: GitGraphRow[];
  currentCommit: string | null;
  remoteCommit: string | null;
  pinnedCommit: string | null;
  busy?: boolean;
  error: string | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  deployCommit: [hash: string];
  unpin: [];
}>();

const deployingHash = ref<string | null>(null);
const unpinning = ref(false);

const hasData = computed(() => props.rows.length > 0);

const layout = computed(() =>
  buildGitGraphLayout(props.rows, {
    currentCommit: props.currentCommit,
    remoteCommit: props.remoteCommit,
  }),
);

const actionsDisabled = computed(
  () =>
    props.busy === true ||
    deployingHash.value !== null ||
    unpinning.value,
);

function isPinnedCommit(commit: GitGraphCommit): boolean {
  return Boolean(
    props.pinnedCommit &&
      (props.pinnedCommit === commit.hash ||
        props.pinnedCommit.startsWith(commit.shortHash) ||
        commit.hash.startsWith(props.pinnedCommit)),
  );
}

function nodeClass(commit: GitGraphCommit): string {
  const isCurrent = props.currentCommit === commit.hash;
  const isRemote = props.remoteCommit === commit.hash;
  if (isCurrent && isRemote) return "node-both";
  if (isCurrent) return "node-current";
  if (isRemote) return "node-remote";
  return "";
}

function nodeFill(commit: GitGraphCommit, laneColor: string): string {
  const isCurrent = props.currentCommit === commit.hash;
  const isRemote = props.remoteCommit === commit.hash;
  if (isCurrent && isRemote) return "#7c3aed";
  if (isCurrent) return "#2563eb";
  if (isRemote) return "#0891b2";
  return laneColor;
}

function canDeploy(commit: GitGraphCommit): boolean {
  return (
    !actionsDisabled.value &&
    Boolean(commit.hash) &&
    commit.hash !== props.currentCommit
  );
}

function onDeploy(commit: GitGraphCommit) {
  if (!canDeploy(commit)) return;
  deployingHash.value = commit.hash;
  emit("deployCommit", commit.hash);
}

function onUnpin() {
  if (actionsDisabled.value || !props.pinnedCommit) return;
  unpinning.value = true;
  emit("unpin");
}

watch(
  () => [props.busy, props.currentCommit, props.pinnedCommit] as const,
  () => {
    if (!props.busy) {
      deployingHash.value = null;
      unpinning.value = false;
    }
  },
);
</script>

<template>
  <section class="panel graph-panel" aria-label="Git graph">
    <div class="head">
      <h2>Git graph</h2>
      <p class="muted">Latest commit history in this deployment branch.</p>
    </div>

    <p v-if="error" class="err">{{ error }}</p>
    <p v-else-if="loading" class="muted">Loading graph…</p>
    <p v-else-if="!hasData" class="muted">No commits available.</p>
    <ol v-else class="graph-body">
      <li
        v-for="(row, idx) in layout.rowLayouts"
        :key="row.commit?.hash ?? `lane-${row.index}`"
        class="row-item"
        :class="[
          row.commit ? nodeClass(row.commit) : 'row-connector',
          row.commit ? 'row-commit' : '',
        ]"
        :style="{ zIndex: idx + 1 }"
      >
        <div
          class="lane-cell"
          :style="{ width: `${layout.width}px` }"
          aria-hidden="true"
        >
          <svg
            class="lane-svg"
            :width="layout.width"
            :viewBox="`0 0 ${layout.width} ${row.height}`"
            preserveAspectRatio="none"
          >
            <path
              v-for="(seg, segIdx) in row.segments"
              :key="`seg-${idx}-${segIdx}`"
              :d="seg.d"
              :stroke="seg.color"
              fill="none"
              :stroke-width="STROKE"
              stroke-linecap="round"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <span
            v-if="row.node && row.commit"
            class="node-dot"
            :class="nodeClass(row.commit)"
            :style="{
              left: `${row.node.cx}px`,
              top: `${TITLE_NODE_OFFSET}px`,
              background: nodeFill(row.commit, row.node.color),
            }"
          />
        </div>

        <article v-if="row.commit" class="content">
          <p class="subject">{{ row.commit.subject }}</p>
          <p class="meta">
            <span class="mono">{{ row.commit.shortHash }}</span>
            <span class="dot">·</span>
            <span>{{ row.commit.author }}</span>
            <span class="dot">·</span>
            <span>{{ row.commit.relativeTime }}</span>
          </p>
          <div v-if="row.commit.refs.length" class="refs">
            <span v-for="ref in row.commit.refs" :key="ref" class="ref">{{
              ref
            }}</span>
          </div>
          <div class="state-tags">
            <span
              v-if="currentCommit === row.commit.hash"
              class="tag tag-current"
            >
              deployed
            </span>
            <span
              v-if="remoteCommit === row.commit.hash"
              class="tag tag-remote"
            >
              remote tip
            </span>
            <span v-if="isPinnedCommit(row.commit)" class="tag tag-pinned">
              pinned
            </span>
          </div>
          <div class="row-actions">
            <button
              v-if="isPinnedCommit(row.commit)"
              type="button"
              class="unpin-btn"
              :disabled="actionsDisabled"
              @click="onUnpin"
            >
              {{ unpinning ? "Unpinning…" : "Unpin" }}
            </button>
            <button
              type="button"
              class="deploy-btn"
              :disabled="!canDeploy(row.commit)"
              @click="onDeploy(row.commit)"
            >
              {{
                deployingHash === row.commit.hash
                  ? "Deploying…"
                  : currentCommit === row.commit.hash
                    ? "Deployed"
                    : "Switch & Rebuild"
              }}
            </button>
          </div>
        </article>
        <div v-else class="connector-pad" :style="{ height: `${row.height}px` }" />
      </li>
    </ol>
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

.head {
  margin-bottom: 0.65rem;
}

.head h2 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
}

.muted {
  margin: 0.35rem 0 0;
  color: #5c6f68;
  font-size: 0.85rem;
}

.graph-body {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 34rem;
  overflow: auto;
  border-radius: 0.6rem;
  border: 1px solid rgba(16, 36, 31, 0.1);
  background: #f7f9f8;
}

.row-item {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: stretch;
  box-sizing: border-box;
  border-bottom: 1px solid rgba(16, 36, 31, 0.06);
  background: #f7f9f8;
}

.row-commit {
  position: sticky;
  top: 0;
  background: #f7f9f8;
  box-shadow: 0 1px 0 rgba(16, 36, 31, 0.06);
}

.row-item:last-child {
  border-bottom: none;
}

.row-connector {
  background: #eef1ef;
}

.lane-cell {
  position: relative;
  flex-shrink: 0;
  background: #eef1ef;
  border-right: 1px dashed rgba(16, 36, 31, 0.14);
  min-height: 100%;
}

.lane-svg {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.node-dot {
  position: absolute;
  z-index: 2;
  width: 11px;
  height: 11px;
  border-radius: 999px;
  border: 2px solid #ffffff;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 1px rgba(16, 36, 31, 0.08);
  pointer-events: none;
}

.node-current .node-dot {
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.22);
}

.node-remote .node-dot {
  box-shadow: 0 0 0 3px rgba(8, 145, 178, 0.2);
}

.node-both .node-dot {
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.25);
}

.content {
  min-width: 0;
  width: 100%;
  padding: 0.55rem 0.7rem 0.55rem 0.6rem;
  background: #f7f9f8;
}

.connector-pad {
  width: 100%;
}

.node-current .content,
.node-current .lane-cell {
  background: #eef3fb;
}

.node-remote .content,
.node-remote .lane-cell {
  background: #eef8f8;
}

.node-both .content,
.node-both .lane-cell {
  background: #f3eefb;
}

.subject {
  margin: 0;
  color: #10241f;
  font-size: 0.86rem;
  line-height: 1.3;
  font-weight: 600;
}

.meta {
  margin: 0.18rem 0 0;
  color: #5c6f68;
  font-size: 0.74rem;
  line-height: 1.4;
}

.mono {
  font-family: "JetBrains Mono", ui-monospace, monospace;
}

.dot {
  margin: 0 0.28rem;
}

.refs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.26rem;
  margin-top: 0.3rem;
}

.ref {
  font-size: 0.68rem;
  color: #1c4437;
  background: rgba(17, 99, 69, 0.1);
  border: 1px solid rgba(16, 76, 54, 0.16);
  border-radius: 999px;
  padding: 0.08rem 0.34rem;
}

.state-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.26rem;
  margin-top: 0.32rem;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.45rem;
}

.deploy-btn,
.unpin-btn {
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 0.28rem 0.55rem;
  border-radius: 0.45rem;
  cursor: pointer;
  transition:
    background 0.2s ease,
    opacity 0.2s ease,
    transform 0.2s ease;
}

.deploy-btn {
  border: 1px solid #16352c;
  background: #16352c;
  color: #f3faf6;
}

.deploy-btn:hover:not(:disabled) {
  background: #1f4a3d;
  transform: translateY(-1px);
}

.unpin-btn {
  border: 1px solid rgba(140, 90, 20, 0.35);
  background: rgba(255, 248, 235, 0.95);
  color: #6b3f14;
}

.unpin-btn:hover:not(:disabled) {
  background: #fff8eb;
  transform: translateY(-1px);
}

.deploy-btn:disabled,
.unpin-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.tag {
  font-size: 0.66rem;
  border-radius: 0.35rem;
  padding: 0.08rem 0.32rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tag-current {
  color: #123f99;
  background: rgba(21, 84, 204, 0.13);
}

.tag-remote {
  color: #0f5d6a;
  background: rgba(18, 122, 135, 0.15);
}

.tag-pinned {
  color: #6b3f14;
  background: rgba(180, 120, 40, 0.16);
}

.err {
  color: #b42318;
  margin: 0;
  font-weight: 500;
}
</style>
