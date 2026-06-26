export interface ValidationCheck {
  id: string;
  passed: boolean;
  score: number;
  message: string;
}

export interface ValidationResult {
  enabled: boolean;
  passed: boolean;
  checks: ValidationCheck[];
}

export function validationFailureMessage(
  validation: ValidationResult | null | undefined,
): string {
  if (!validation?.enabled || validation.passed) return "";
  const failed = validation.checks.filter((c) => !c.passed);
  if (failed.length === 0) return "This photo did not pass validation.";
  return failed.map((c) => c.message).join("\n\n");
}

export class PhotoValidationError extends Error {
  validation: ValidationResult;

  constructor(message: string, validation: ValidationResult) {
    super(message);
    this.name = "PhotoValidationError";
    this.validation = validation;
  }
}

/** Reliable check across Hermes/module boundaries where `instanceof` can fail. */
export function isPhotoValidationError(error: unknown): error is PhotoValidationError {
  return (
    error instanceof PhotoValidationError ||
    (typeof error === "object" &&
      error !== null &&
      (error as PhotoValidationError).name === "PhotoValidationError" &&
      "validation" in error)
  );
}
