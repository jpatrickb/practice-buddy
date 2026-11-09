export interface Env {
  CONTENT: R2Bucket;
  ASSETS?: Fetcher;
  /** Worker secret (`.dev.vars` locally). At least 32 chars. */
  COOKIE_SIGNING_KEY: string;
  /** Manifest cache TTL in seconds. Defaults to 60; tests set 0. */
  MANIFEST_TTL_SECONDS?: string;
}
