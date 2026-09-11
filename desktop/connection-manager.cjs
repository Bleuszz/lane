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
  function set(p, status, error = null) {
    p.status = status;
    p.connectionError = error;
    changed(p);
  }
  function run(p, fn) {
    if (operations.has(p.id)) return operations.get(p.id).promise;
    const controller = new AbortController();
    const operation = { controller, promise: null };
    operations.set(p.id, operation);
    operation.promise = Promise.resolve()
      .then(() => fn(controller.signal))
      .catch((error) => {
        if (controller.signal.aborted || p.disconnected) return;
        const code = error.code || "NETWORK";
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
        if (operations.get(p.id) === operation) operations.delete(p.id);
      });
    return operation.promise;
  }
  function active(p, signal) {
    if (signal.aborted || p.disconnected) throw failure("CANCELLED");
  }
  async function validate(p, signal, expected) {
    active(p, signal);
    set(p, STATES.VALIDATING_SESSION);
    if (!(await adapter.hasSession(p))) throw failure("NO_SESSION");
    active(p, signal);
    const evidence = await adapter.validate(p, signal);
    active(p, signal);
    if (evidence?.challenge) throw failure("CHALLENGE");
    if (evidence?.pageError) throw failure("PAGE_UNAVAILABLE");
    if (evidence?.identity && expected && evidence.identity !== expected)
      throw failure("ACCOUNT_CHANGED");
    if (!validated(evidence, expected)) throw failure("NOT_AUTHENTICATED");
    try {
      await adapter.persist(p);
    } catch {
      throw failure("STORAGE");
    }
    active(p, signal);
    p.identity = evidence.identity;
    p.wardrobeUrl = evidence.wardrobeUrl || p.wardrobeUrl || null;
    p.validatedAt = new Date(now()).toISOString();
    p.lastSeen = p.validatedAt;
    set(p, STATES.CONNECTED);
    return evidence;
  }
  async function sync(p, signal, evidence) {
    const result = await adapter.listings(p, evidence, signal);
    active(p, signal);
    if (result?.challenge) throw failure("CHALLENGE");
    if (!result?.authenticated || result.identity !== p.identity)
      throw failure("NOT_AUTHENTICATED");
    if (result.ownPage && result.listingStateKnown) {
      p.links = result.links;
      p.listingCount = result.links.length;
      p.lastSyncAt = new Date(now()).toISOString();
      p.syncMessage = "Current listings page refreshed.";
    } else {
      p.links = [];
      p.listingCount = null;
      p.syncMessage = "Account validated. Listing information is not available from this page yet.";
    }
    changed(p);
  }
  return {
    connect(p) {
      return run(p, async (signal) => {
        set(p, STATES.OPENING_LOGIN);
        let login;
        try {
          login = await adapter.openLogin(p, signal);
          active(p, signal);
          set(p, STATES.WAITING_FOR_USER_LOGIN);
          const deadline = now() + loginTimeout;
          while (now() < deadline) {
            active(p, signal);
            const candidate = await adapter.inspectLogin(p, login, signal);
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
      return run(p, async (signal) => {
        const evidence = await validate(p, signal, p.identity);
        await sync(p, signal, evidence);
      });
    },
    read(p) {
      return run(p, async (signal) => {
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
    stop() {
      const pending = [...operations.values()];
      for (const op of pending) op.controller.abort();
      return Promise.all(pending.map((op) => op.promise));
    },
  };
}
module.exports = { STATES, messages, failure, validated, createConnectionManager };
