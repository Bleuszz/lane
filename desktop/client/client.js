const api = window.laneClient;
const $ = (id) => document.getElementById(id);
let busy = false;
const labels = {
  DISCONNECTED: "Not connected",
  OPENING_LOGIN: "Opening sign-in…",
  WAITING_FOR_USER_LOGIN: "Finish sign-in in the marketplace window",
  AUTHENTICATED_SESSION_CAPTURED: "Securing your session…",
  VALIDATING_SESSION: "Checking your account…",
  CONNECTED: "Connected",
  SESSION_EXPIRED: "Session expired — reconnect",
  RECONNECT_REQUIRED: "Reconnect required",
  ERROR: "Connection could not be completed",
};
function button(text, run, secondary = false) {
  const el = document.createElement("button");
  el.textContent = text;
  if (secondary) el.className = "secondary";
  el.onclick = () => act(run);
  return el;
}
async function act(run) {
  if (busy) return;
  busy = true;
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    const result = await run();
    $("notice").textContent = result.error || result.message || "";
    await refresh();
  } catch {
    $("notice").textContent = "Could not finish this step. Reopen Lane and try again.";
  } finally {
    busy = false;
    document.querySelectorAll("button").forEach((b) => (b.disabled = false));
    await refresh();
  }
}
async function refresh() {
  const state = await api.status();
  document.body.classList.toggle("session-diagnostic", state.diagnosticRun);
  $("build-fingerprint").textContent = state.buildInfo
    ? `Lane ${state.version} · ${state.diagnosticRun ? "SESSION DIAGNOSTIC — DIAGNOSTIC BUILD" : "BUILD"}\nCommit: ${state.buildInfo.shortCommit}\nBuild: ${state.buildInfo.builtAt}`
    : `Lane ${state.version} · SESSION DIAGNOSTIC\nUnpackaged development source`;
  $("unpair").hidden = !state.paired;
  $("sign-in").hidden = state.paired;
  $("version").textContent =
    "VERSION " + state.version + (state.diagnosticRun ? " · SESSION DIAGNOSTIC" : "");
  $("startup").checked = state.startup;
  $("pause").checked = state.paused;
  if (document.activeElement !== $("origin")) $("origin").value = state.origin;
  $("pair-status").textContent = state.paired
    ? "Paired · " + state.bridgeHealth
    : state.pairingCode
      ? "Check this code in your browser: " + state.pairingCode
      : state.origin
        ? "Website configured. Sign in to pair this device."
        : "A staging address is needed before account pairing.";
  $("profiles").replaceChildren();
  for (const [marketplace, name] of [
    ["vinted_uk", "Vinted"],
    ["ebay_uk", "eBay"],
  ]) {
    const p = state.profiles.find((p) => p.marketplace === marketplace);
    const card = document.createElement("article");
    card.className = "shop";
    const h = document.createElement("h3");
    h.textContent = name;
    const status = document.createElement("p");
    status.className = "status";
    status.textContent = p ? labels[p.status] || "Unknown" : "Not connected";
    const detail = document.createElement("p");
    detail.textContent = p
      ? `${p.identity ? p.identity.replace(/^(vinted|ebay):/, "") + " · " : ""}${p.listingCount === null ? "Listing count unknown" : p.listingCount + " listings on current page"} · ${p.read} items read locally${p.lastSyncAt ? " · Last sync " + new Date(p.lastSyncAt).toLocaleTimeString() : ""}`
      : "Open a secure window and sign in directly. No marketplace password is sent to Lane.";
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(button(p ? "Reconnect" : "Connect " + name, () => api.connect(marketplace)));
    actions.append(
      button("SESSION PROBE", () => (p ? showProbe(p.id) : showEmptyProbe(marketplace)), true),
    );
    if (p) {
      const refreshButton = button("Refresh listings", () => api.inspect(p.id), true);
      const readButton = button("Read item details", () => api.read(p.id), true);
      for (const b of [refreshButton, readButton]) {
        b.disabled = p.busy;
        b.title = p.busy
          ? "Finish connecting " + name + " first (or wait for the current operation)."
          : "";
      }
      actions.append(
        refreshButton,
        readButton,
        button("Discovered listings", () => showLinks(p.id), true),
        button("Review read items", () => reviewItems(p.id), true),
        button("Disconnect", () => api.disconnect(p.id), true),
      );
    }
    const feedback = document.createElement("p");
    feedback.className = "connection-feedback";
    feedback.setAttribute("role", "status");
    feedback.textContent =
      (p?.connectionError || p?.syncMessage || "") +
      (p?.diagnostic?.stage ? " · " + p.diagnostic.stage : "") +
      (p?.operation === "connect"
        ? " · Finish connecting " + name + " first; Refresh and Read are disabled."
        : "");
    card.append(h, status, detail, feedback, actions);
    $("profiles").append(card);
  }
}
async function showEmptyProbe(marketplace) {
  return showProbeResult({
    marketplace,
    stage: "DISCONNECTED",
    sessionPresent: false,
    cookieCount: 0,
    identityResolved: false,
    validationResult: "not_started",
    listingStateKnown: false,
    linksFound: 0,
    lastErrorCode: null,
    lastSuccessfulStage: null,
  });
}
async function showProbe(id) {
  const result = await api.probe(id);
  if (!result.probe) return result;
  return showProbeResult(result.probe);
}
function showProbeResult(probe) {
  const dialog = document.createElement("dialog");
  dialog.className = "observations";
  const close = textElement("button", "Close", "secondary");
  close.onclick = () => dialog.close();
  dialog.append(
    close,
    textElement("h2", "Session probe"),
    textElement(
      "p",
      "Metadata only. No cookie values, tokens or page content. A readable seller page with unresolved identity is a parser gate; a logged-out background page is a session/validation gate.",
    ),
    textElement("pre", JSON.stringify(probe, null, 2)),
  );
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
  return {
    message: "Session probe completed. Copy diagnostics includes its sanitised gate summary.",
  };
}
async function showLinks(id) {
  const result = await api.listingLinks(id);
  const dialog = document.createElement("dialog");
  dialog.className = "observations";
  const close = textElement("button", "Close", "secondary");
  close.onclick = () => dialog.close();
  dialog.append(close, textElement("h2", "Discovered owned listings"));
  for (const link of result.links || [])
    dialog.append(
      textElement("p", `${link.remoteId} · ${link.title || "Title unknown"} · ${link.url}`),
    );
  if (!result.links?.length)
    dialog.append(
      textElement(
        "p",
        "No owned listing links extracted. This does not establish an empty account.",
      ),
    );
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
  return {};
}
$("configure").onsubmit = (e) => {
  e.preventDefault();
  act(() => api.configure($("origin").value));
};
$("sign-in").onclick = () => act(() => api.signIn());
$("web").onclick = () => act(() => api.openWeb());
$("diagnostics").onclick = () => act(() => api.diagnostics());
$("pause").onchange = () => act(() => api.pause($("pause").checked));
$("startup").onchange = () => act(() => api.startup($("startup").checked));
refresh();

setInterval(() => {
  if (!busy) refresh().catch(() => undefined);
}, 3000);
$("unpair").onclick = () => act(() => api.unpair());

function textElement(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}
async function reviewItems(id) {
  const result = await api.observations(id);
  if (!result.ok) return result;
  const dialog = document.createElement("dialog");
  dialog.className = "observations";
  dialog.setAttribute("aria-label", "Local listing observations");
  const close = textElement("button", "Close review", "secondary");
  close.onclick = () => dialog.close();
  dialog.append(
    close,
    textElement("h2", "What Lane read"),
    textElement(
      "p",
      "Partial page observations saved on this computer. Compare every field and photo with your original listing. These items are not yet imported into cloud inventory.",
    ),
  );
  if (!result.items.length)
    dialog.append(
      textElement(
        "p",
        "No items read yet. Choose Refresh listings, then Read item details. No marketplace window is needed unless you must reconnect.",
      ),
    );
  for (const item of result.items) {
    const article = document.createElement("article");
    article.append(textElement("h3", item.title || "Unknown title"));
    const fields = document.createElement("dl");
    for (const [label, value] of [
      ["Source ID", item.remoteId],
      ["Source URL", item.url],
      ["Price (GBP)", item.priceGbp],
      ["Brand", item.brand],
      ["Category", item.categoryName],
      ["Size", item.sizeLabel],
      ["Condition", item.conditionLabel],
      ["Colours", item.colour],
      ["Material", item.material],
      ["Status", item.status],
      ["Quantity", item.quantity],
      ["Description", item.description],
      ...Object.entries(item.attributes),
    ])
      fields.append(
        textElement("dt", label),
        textElement(
          "dd",
          value === null || value === undefined || value === "" ? "Unknown" : String(value),
        ),
      );
    article.append(fields, textElement("h4", `${item.photoUrls.length} photos in observed order`));
    const photos = document.createElement("ol");
    photos.className = "observed-photos";
    for (const [index, source] of item.photoUrls.entries()) {
      const li = document.createElement("li");
      li.append(textElement("span", `Photo ${index + 1}`));
      // Display only supported marketplace image hosts; never attach session headers.
      try {
        const url = new URL(source);
        if (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          ["vinted.net", "ebayimg.com"].some(
            (host) => url.hostname === host || url.hostname.endsWith("." + host),
          )
        ) {
          const img = document.createElement("img");
          img.src = url.href;
          img.alt = `Observed product photo ${index + 1}`;
          img.referrerPolicy = "no-referrer";
          img.loading = "lazy";
          li.append(img);
        }
      } catch {
        /* Keep the observed URL visible for review without fetching it. */
      }
      li.append(textElement("small", source));
      photos.append(li);
    }
    article.append(photos);
    dialog.append(article);
  }
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
  close.focus();
  return { ok: true };
}
