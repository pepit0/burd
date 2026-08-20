export type FieldGuideIntentTab = "guide" | "explore" | "pet" | "collection";

interface FieldGuideIntent {
  sortLoggedFirst: boolean;
  userId: string | null;
  tab?: FieldGuideIntentTab;
}

type FieldGuideIntentListener = (intent: FieldGuideIntent) => void;

let fieldGuideIntent: FieldGuideIntent | null = null;
const fieldGuideIntentListeners = new Set<FieldGuideIntentListener>();

export function subscribeFieldGuideIntent(
  listener: FieldGuideIntentListener,
): () => void {
  fieldGuideIntentListeners.add(listener);
  return () => {
    fieldGuideIntentListeners.delete(listener);
  };
}

/** Open field guide sorted by logged species (optionally for another user). */
export function requestFieldGuideView(options?: {
  sortLoggedFirst?: boolean;
  userId?: string | null;
  tab?: FieldGuideIntentTab;
}): void {
  const intent: FieldGuideIntent = {
    sortLoggedFirst: options?.sortLoggedFirst ?? false,
    userId: options?.userId ?? null,
    tab: options?.tab,
  };
  fieldGuideIntent = intent;
  if (fieldGuideIntentListeners.size > 0) {
    for (const listener of fieldGuideIntentListeners) {
      listener(intent);
    }
    fieldGuideIntent = null;
  }
}

/** @deprecated Use requestFieldGuideView({ sortLoggedFirst: true }). */
export function requestFieldGuideLoggedFirst(): void {
  requestFieldGuideView({ sortLoggedFirst: true });
}

export function consumeFieldGuideIntent(): FieldGuideIntent | null {
  const intent = fieldGuideIntent;
  fieldGuideIntent = null;
  return intent;
}

/** @deprecated Use consumeFieldGuideIntent(). */
export function consumeFieldGuideLoggedFirst(): boolean {
  return consumeFieldGuideIntent()?.sortLoggedFirst ?? false;
}
