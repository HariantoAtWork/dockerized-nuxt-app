<script setup lang="ts">
import type { ToastItem } from "../composables/useToast.ts";

defineProps<{
  items: ToastItem[];
}>();
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="t-stack">
      <div
        v-for="t in items"
        :key="t.id"
        class="toast"
        :class="`toast-${t.variant}`"
      >
        {{ t.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
  pointer-events: none;
}

.toast {
  max-width: 22rem;
  padding: 0.65rem 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  font-size: 0.9rem;
  line-height: 1.35;
  pointer-events: auto;
}

.toast-success {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.toast-error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.toast-info {
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}

.t-stack-move,
.t-stack-enter-active,
.t-stack-leave-active {
  transition: all 0.28s ease;
}

.t-stack-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.t-stack-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
