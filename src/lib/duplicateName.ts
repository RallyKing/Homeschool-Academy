/** Backend duplicate-name errors that the UI may retry after an explicit confirm. */
export function isDuplicateNameError(message: string): boolean {
  return /already exists|already a student at this school|already a contact/i.test(
    message,
  );
}

/**
 * Run a create/rename once. If Convex blocked a duplicate name, ask the user
 * whether to keep both records, then retry with `allowDuplicateName: true`.
 */
export async function withDuplicateNameOverride<T>(
  run: (allowDuplicateName: boolean) => Promise<T>,
): Promise<T> {
  try {
    return await run(false);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    if (
      typeof window !== "undefined" &&
      isDuplicateNameError(message) &&
      window.confirm(`${message}\n\nCreate anyway? This keeps both records.`)
    ) {
      return await run(true);
    }
    throw err;
  }
}
