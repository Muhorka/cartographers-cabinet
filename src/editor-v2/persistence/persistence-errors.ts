type PersistenceErrorCode = "validation" | "quota" | "unavailable" | "not-found" | "storage";

export type SafePersistenceError = {
  code: PersistenceErrorCode;
  reason: string;
};

/** Convert storage failures to a small, non-sensitive diagnostic for the UI. */
export function safePersistenceError(error: unknown): SafePersistenceError {
  const name = error instanceof Error ? error.name : "";
  if (name === "ZodError" || name === "ValidationError") return { code: "validation", reason: "The project data is invalid." };
  if (name === "QuotaExceededError") return { code: "quota", reason: "There is not enough local storage space." };
  if (["InvalidStateError", "TransactionInactiveError", "DatabaseClosedError", "AbortError"].includes(name)) return { code: "unavailable", reason: "Local storage is temporarily unavailable." };
  if (name === "NotFoundError") return { code: "not-found", reason: "The requested project or checkpoint was not found." };
  return { code: "storage", reason: "The change could not be saved to local storage." };
}
