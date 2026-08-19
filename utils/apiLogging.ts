/** Long enough to identify the failure, short enough to carry no payload. */
const MAX_LOGGED_LENGTH = 300;

/**
 * Provider errors echo the offending request back, which for these routes means
 * the user's meal photo or lab report. Truncating keeps the diagnosis in the
 * log and the document out of it.
 */
export function logApiFailure(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const trimmed =
    message.length > MAX_LOGGED_LENGTH
      ? `${message.slice(0, MAX_LOGGED_LENGTH)}… [levágva]`
      : message;
  console.error(`${scope} failed:`, trimmed);
}
