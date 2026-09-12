export function waitForAuthPopup(
  popup: Window,
  host: Window = window,
  timeoutMs = 120000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      host.clearInterval(poll);
      host.clearTimeout(deadline);
      if (closeTimer !== undefined) host.clearTimeout(closeTimer as unknown as number);
      host.removeEventListener("message", onMessage);
    };
    const finish = (token: string | null, reason: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        popup.close();
      } catch {
        /* already closed */
      }
      if (token) resolve(token);
      else reject(new Error(reason));
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== host.location.origin || event.source !== popup) return;
      const data = event.data;
      if (data?.source !== "grok-auth-popup") return;
      finish(
        typeof data.token === "string" ? data.token : null,
        "Sign-in failed or was cancelled. Retry, or use email sign-in.",
      );
    };
    const poll = host.setInterval(() => {
      if (popup.closed && !closeTimer)
        closeTimer = setTimeout(() => finish(null, "Sign-in was cancelled. You can retry."), 400);
    }, 250);
    const deadline = host.setTimeout(
      () =>
        finish(null, "Sign-in timed out. Retry, allow the sign-in popup, or use email sign-in."),
      timeoutMs,
    );
    host.addEventListener("message", onMessage);
  });
}
