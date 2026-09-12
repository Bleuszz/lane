const STATES = Object.freeze({
  DISCONNECTED: "DISCONNECTED",
  OPENING_LOGIN: "OPENING_LOGIN",
  WAITING_FOR_USER_LOGIN: "WAITING_FOR_USER_LOGIN",
  AUTHENTICATED_SESSION_CAPTURED: "AUTHENTICATED_SESSION_CAPTURED",
  VALIDATING_SESSION: "VALIDATING_SESSION",
  CONNECTED: "CONNECTED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  RECONNECT_REQUIRED: "RECONNECT_REQUIRED",
  ERROR: "ERROR",
});
const messages = {
  SESSION_MISMATCH:
    "Session boundary failed: the background page is not using this account's Electron session.",
  IDENTITY_UNRESOLVED:
    "The seller page is accessible, but Lane cannot resolve a stable account identity. Run Session probe; keep this window open.",
  EXTRACTION_FAILED:
    "The marketplace reports active listings, but Lane extracted no owned links. Run Session probe; sync has not succeeded.",
  LISTING_STATE_UNKNOWN:
    "Account validated, but listing discovery could not establish the owned listing state. Run Session probe.",
  LISTING_COUNT_MISMATCH:
    "Lane found only part of the reported listings. Sync is incomplete; run Session probe.",
  CANCELLED: "Sign-in was cancelled. Choose Connect to try again.",
  LOGIN_TIMEOUT: "Sign-in timed out. Choose Connect and finish the marketplace verification.",
  CHALLENGE: "The marketplace needs verification. Choose Reconnect to complete it yourself.",
  NOT_AUTHENTICATED: "Your session could not be validated. Choose Reconnect and sign in again.",
  NO_SESSION: "No usable saved session was found. Choose Reconnect.",
  ACCOUNT_CHANGED:
    "The marketplace account changed. Disconnect it before connecting another account.",
  PAGE_UNAVAILABLE:
    "The marketplace page is unavailable. Retry later; no connection was confirmed.",
  NETWORK: "The marketplace did not respond in time. Retry the connection or refresh.",
  STORAGE:
    "The session could not be saved securely. Close Lane and retry; no connection was confirmed.",
};
function failure(code) {
  return Object.assign(new Error(messages[code] || messages.NETWORK), { code });
}
function validated(evidence, identity) {
  return Boolean(
    evidence?.authenticated &&
    evidence.protectedPage &&
    evidence.identity &&
    (!identity || evidence.identity === identity),
  );
}
function createConnectionManager(
  adapter,
  { changed = () => {}, now = Date.now, pollMs = 1500, loginTimeout = 300000 } = {},
) {
  const operations = new Map();
  function stage(p, value, success = false) {
    p.diagnostic ||= {};
    p.diagnostic.stage = value;
    if (success) p.diagnostic.lastSuccessfulStage = value;
    changed(p);
  }
  function set(p, status, error = null) {
    p.status = status;
    p.connectionError = error;
    changed(p);
  }
  function run(p, name, fn) {
    if (operations.has(p.id)) {
      const existing = operations.get(p.id);
      return existing.name === name
        ? existing.promise
        : Promise.resolve({ blocked: true, operation: existing.name });
    }
    const controller = new AbortController();
    const operation = { controller, promise: null, name };
    p.operation = name;
    operations.set(p.id, operation);
    operation.promise = Promise.resolve()
      .then(() => fn(controller.signal))
      .catch((error) => {
        if (controller.signal.aborted || p.disconnected) return;
        const code = Object.hasOwn(messages, error.code) ? error.code : "NETWORK";
        p.diagnostic ||= {};
        p.diagnostic.lastErrorCode = code;
        p.diagnostic.lastErrorCategory =
          code.startsWith("LISTING_") || code === "EXTRACTION_FAILED"
            ? "extraction"
            : code === "IDENTITY_UNRESOLVED" || code === "ACCOUNT_CHANGED"
              ? "identity"
              : code === "SESSION_MISMATCH"
                ? "session_boundary"
                : code === "STORAGE"
                  ? "storage"
                  : code === "NETWORK" || code === "PAGE_UNAVAILABLE"
                    ? "navigation"
                    : "authentication";
        p.diagnostic.lastErrorAt = new Date(now()).toISOString();
        p.diagnostic.stage =
          p.diagnostic.lastErrorCategory === "extraction"
            ? "LISTING_DISCOVERY_FAILED"
            : "AUTH_VALIDATION_FAILED";
        set(
          p,
          code === "CANCELLED" || code === "LOGIN_TIMEOUT"
            ? STATES.DISCONNECTED
            : ["NO_SESSION", "NOT_AUTHENTICATED"].includes(code)
              ? STATES.SESSION_EXPIRED
              : ["CHALLENGE", "ACCOUNT_CHANGED"].includes(code)
                ? STATES.RECONNECT_REQUIRED
                : STATES.ERROR,
          messages[code] || messages.NETWORK,
        );
      })
      .finally(() => {
        if (operations.get(p.id) === operation) {
          operations.delete(p.id);
          p.operation = null;
          changed(p);
        }
      });
    return operation.promise;
  }
  function active(p, signal) {
    if (signal.aborted || p.disconnected) throw failure("CANCELLED");
  }
  async function validate(p, signal, expected) {
    active(p, signal);
    set(p, STATES.VALIDATING_SESSION);
    stage(p, "AUTH_VALIDATION_STARTED");
    if (!(await adapter.hasSession(p))) throw failure("NO_SESSION");
    active(p, signal);
    const evidence = await adapter.validate(p, signal);
    active(p, signal);
    if (evidence?.challenge) throw failure("CHALLENGE");
    if (evidence?.pageError) throw failure("PAGE_UNAVAILABLE");
    if (evidence?.pageAccessConfirmed && !evidence.identity) throw failure("IDENTITY_UNRESOLVED");
    if (evidence?.identity && expected && evidence.identity !== expected)
      throw failure("ACCOUNT_CHANGED");
    if (!validated(evidence, expected)) throw failure("NOT_AUTHENTICATED");
    stage(p, "AUTH_VALIDATION_PASSED", true);
    try {
      await adapter.persist(p);
    } catch {
      throw failure("STORAGE");
    }
    active(p, signal);
    stage(p, "SESSION_PERSISTED", true);
    p.identity = evidence.identity;
    p.wardrobeUrl = evidence.wardrobeUrl || p.wardrobeUrl || null;
    p.validatedAt = new Date(now()).toISOString();
    p.lastSeen = p.validatedAt;
    set(p, STATES.CONNECTED);
    return evidence;
  }
  async function sync(p, signal, evidence) {
    stage(p, "LISTING_DISCOVERY_STARTED");
    const result = await adapter.listings(p, evidence, signal);
    active(p, signal);
    if (result?.challenge) throw failure("CHALLENGE");
    if (!result?.authenticated || result.identity !== p.identity)
      throw failure("NOT_AUTHENTICATED");
    p.diagnostic ||= {};
    p.diagnostic.listingStateKnown = Boolean(result.listingStateKnown);
    p.diagnostic.visibleListingCount = result.visibleListingCount ?? null;
    p.links = result.ownPage ? result.links || [] : [];
    p.diagnostic.linksFound = p.links.length;
    p.diagnostic.countsAgree =
      result.visibleListingCount === null || result.visibleListingCount === undefined
        ? "unknown"
        : p.links.length === result.visibleListingCount
          ? "yes"
          : "no";
    p.listingCount = result.listingStateKnown ? p.links.length : null;
    if (result.visibleListingCount > 0 && !p.links.length) throw failure("EXTRACTION_FAILED");
    if (result.visibleListingCount != null && result.visibleListingCount !== p.links.length)
      throw failure("LISTING_COUNT_MISMATCH");
    if (result.ownPage && result.listingStateKnown) {
      p.links = result.links;
      p.listingCount = result.links.length;
      p.lastSyncAt = new Date(now()).toISOString();
      p.syncMessage = "Current listings page refreshed.";
      stage(p, "LISTING_DISCOVERY_PASSED", true);
    } else {
      p.links = [];
      p.listingCount = null;
      p.syncMessage = "Account validated. Listing information is not available from this page yet.";
      throw failure("LISTING_STATE_UNKNOWN");
    }
    changed(p);
  }
  return {
    connect(p) {
      return run(p, "connect", async (signal) => {
        set(p, STATES.OPENING_LOGIN);
        let login;
        try {
          login = await adapter.openLogin(p, signal);
          stage(p, "LOGIN_WINDOW_OPENED", true);
          active(p, signal);
          set(p, STATES.WAITING_FOR_USER_LOGIN);
          const deadline = now() + loginTimeout;
          while (now() < deadline) {
            active(p, signal);
            const candidate = await adapter.inspectLogin(p, login, signal);
            if (p.diagnostic?.sessionPresent) stage(p, "AUTH_COOKIE_DETECTED", true);
            if (candidate.pageAccessConfirmed && !candidate.identity) {
              stage(p, "ACCOUNT_IDENTITY_UNRESOLVED");
              p.connectionError = messages.IDENTITY_UNRESOLVED;
            }
            if (candidate.identity) stage(p, "ACCOUNT_IDENTITY_RESOLVED", true);
            if (candidate.closed) throw failure("CANCELLED");
            if (candidate.pageError) throw failure("PAGE_UNAVAILABLE");
            if (
              candidate.authenticated &&
              candidate.identity &&
              !candidate.challenge &&
              (await adapter.hasSession(p))
            ) {
              set(p, STATES.AUTHENTICATED_SESSION_CAPTURED);
              const evidence = await validate(p, signal, p.identity || candidate.identity);
              await adapter.closeLogin(p, login);
              login = null;
              await sync(p, signal, evidence);
              return;
            }
            await adapter.delay(pollMs, signal);
          }
          throw failure("LOGIN_TIMEOUT");
        } finally {
          if (login) await adapter.closeLogin(p, login);
        }
      });
    },
    refresh(p) {
      return run(p, "refresh", async (signal) => {
        const evidence = await validate(p, signal, p.identity);
        await sync(p, signal, evidence);
      });
    },
    read(p) {
      return run(p, "read", async (signal) => {
        const evidence = await validate(p, signal, p.identity);
        await sync(p, signal, evidence);
        if (!p.links?.length) return;
        const items = await adapter.readItems(p, p.links.slice(0, 2), signal);
        active(p, signal);
        p.items = items;
        changed(p);
      });
    },
    async disconnect(p) {
      p.disconnected = true;
      const op = operations.get(p.id);
      op?.controller.abort();
      await adapter.clear(p);
      await op?.promise;
      p.identity = null;
      p.links = [];
      p.items = [];
      p.listingCount = null;
      p.validatedAt = null;
      p.lastSyncAt = null;
      set(p, STATES.DISCONNECTED);
    },
    busy(id) {
      return operations.has(id);
    },
    operation(id) {
      return operations.get(id)?.name || null;
    },
    stop() {
      const pending = [...operations.values()];
      for (const op of pending) op.controller.abort();
      return Promise.all(pending.map((op) => op.promise));
    },
  };
}
module.exports = { STATES, messages, failure, validated, createConnectionManager };
