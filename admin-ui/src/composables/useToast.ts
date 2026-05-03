import { ref } from "vue";

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

let idCounter = 0;

export function useToast() {
  const items = ref<ToastItem[]>([]);

  function push(message: string, variant: ToastVariant = "info") {
    const id = ++idCounter;
    items.value.push({ id, message, variant });
    const dismissMs = variant === "error" ? 7000 : 4500;
    setTimeout(() => {
      items.value = items.value.filter((x) => x.id !== id);
    }, dismissMs);
  }

  return { items, push };
}
