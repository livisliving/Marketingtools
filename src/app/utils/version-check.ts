// Lightweight "new version available" check for the GitHub Pages deployment.
//
// The build stamps the current version (from package.json) into APP_VERSION.
// A small JSON file (public/version.json) is deployed alongside the app and
// bumped on each release. We poll it; if the deployed version is newer than the
// running one, the app shows a "Refresh to update" banner. On Pages, refreshing
// loads the new build. Any network/parse failure is a silent no-op — the check
// never blocks or breaks the app (and offline single-file copies just skip it).

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

// Resolve version.json relative to the app's base URL so it works under a Pages
// sub-path (/Marketingtools/version.json) and at the root alike.
const VERSION_URL = new URL(
  `${import.meta.env.BASE_URL}version.json`,
  window.location.href,
).toString();

/** Compare two dotted numeric versions. Returns true if `remote` > `local`. */
export function isNewer(remote: string, local: string): boolean {
  const r = remote.split('.').map((n) => parseInt(n, 10) || 0);
  const l = local.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const a = r[i] ?? 0;
    const b = l[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

/** Fetch the deployed version; returns it if newer than APP_VERSION, else null. */
export async function checkForUpdate(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const remote = typeof data?.version === 'string' ? data.version : null;
    if (remote && isNewer(remote, APP_VERSION)) return remote;
    return null;
  } catch {
    return null; // offline / not hosted / parse error — ignore
  }
}

/**
 * Poll for updates. Calls `onUpdate(remoteVersion)` the first time a newer
 * version is seen, then stops polling. Returns a cleanup function.
 */
export function startUpdatePolling(
  onUpdate: (remoteVersion: string) => void,
  intervalMs = 5 * 60 * 1000,
): () => void {
  // Disabled in single-file/offline builds (no host to poll; a file:// fetch
  // can hard-fail in strict viewers). Also skip when not served over http(s).
  const updateCheckEnabled =
    typeof __UPDATE_CHECK__ === 'undefined' ? true : __UPDATE_CHECK__;
  if (!updateCheckEnabled || !/^https?:$/.test(window.location.protocol)) {
    return () => {};
  }

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    if (stopped) return;
    const remote = await checkForUpdate();
    if (stopped) return;
    if (remote) {
      onUpdate(remote);
      return; // found it — stop polling
    }
    timer = setTimeout(tick, intervalMs);
  };

  // First check shortly after load (let the app settle), then on interval.
  timer = setTimeout(tick, 3000);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
