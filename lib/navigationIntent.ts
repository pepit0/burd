interface FieldGuideIntent {
  sortLoggedFirst: boolean;
  userId: string | null;
}

let fieldGuideIntent: FieldGuideIntent | null = null;

/** Open field guide sorted by logged species (optionally for another user). */
export function requestFieldGuideView(options?: {
  sortLoggedFirst?: boolean;
  userId?: string | null;
}): void {
  fieldGuideIntent = {
    sortLoggedFirst: options?.sortLoggedFirst ?? false,
    userId: options?.userId ?? null,
  };
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
