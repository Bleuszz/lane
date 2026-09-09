const originEl = document.getElementById("origin");
const tokenEl = document.getElementById("token");
const statusEl = document.getElementById("status");
const msgEl = document.getElementById("msg");

function setMsg(text, kind) {
  msgEl.textContent = text;
  msgEl.className = `msg ${kind ?? ""}`;
}

function setStatus(paired) {
  statusEl.textContent = paired ? "Paired" : "Not paired";
  statusEl.className = `pill${paired ? " ok" : ""}`;
}

chrome.storage.local.get(["origin", "token", "sessionCaptured", "sessionUsername"], (stored) => {
  originEl.value = stored.origin ?? "";
  tokenEl.value = stored.token ?? "";
  setStatus(Boolean(stored.origin && stored.token?.startsWith("lnb_")));
  const sessionEl = document.getElementById("session");
  if (sessionEl) {
    sessionEl.textContent = stored.sessionCaptured
      ? `Session captured${stored.sessionUsername ? " · " + stored.sessionUsername : ""}.`
      : "Session: not captured yet. Sign in on vinted.co.uk.";
  }
});

document.getElementById("save").addEventListener("click", () => {
  const origin = originEl.value.trim().replace(/\/$/, "");
  const token = tokenEl.value.trim();
  chrome.runtime.sendMessage({ type: "SAVE_CONFIG", origin, token }, (res) => {
    if (res?.error) {
      setMsg(res.error, "err");
      setStatus(false);
      return;
    }
    setStatus(Boolean(origin && token.startsWith("lnb_")));
    setMsg("Saved. Open vinted.co.uk signed in.", "ok");
  });
});

document.getElementById("test").addEventListener("click", async () => {
  const origin = originEl.value.trim().replace(/\/$/, "");
  const token = tokenEl.value.trim();
  if (!origin || !token) {
    setMsg("Origin and token are required.", "err");
    return;
  }
  try {
    const res = await fetch(`${origin}/api/bridge/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    setMsg(`Paired. ${json.accounts?.length ?? 0} extension account(s) on this user.`, "ok");
    setStatus(true);
  } catch (err) {
    setMsg(err instanceof Error ? err.message : String(err), "err");
    setStatus(false);
  }
});
