const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const MARKETPLACES = {
  vinted_uk: {
    label: "Vinted",
    home: "https://www.vinted.co.uk",
    login: "https://www.vinted.co.uk/inbox",
    validate: "https://www.vinted.co.uk/inbox",
    hosts: ["vinted.co.uk", "www.vinted.co.uk"],
  },
  ebay_uk: {
    label: "eBay",
    home: "https://www.ebay.co.uk",
    login: "https://www.ebay.co.uk/sh/lst/active",
    validate: "https://www.ebay.co.uk/sh/lst/active",
    hosts: [
      "ebay.co.uk",
      "www.ebay.co.uk",
      "signin.ebay.co.uk",
      "accounts.ebay.co.uk",
      "auth.ebay.co.uk",
      "ebay.com",
      "www.ebay.com",
      "signin.ebay.com",
      "accounts.ebay.com",
      "auth.ebay.com",
    ],
  },
};
function laneOrigin(value, development = false) {
  const u = new URL(value);
  if (u.username || u.password || u.search || u.hash || !["", "/"].includes(u.pathname))
    throw new Error("Use the exact Lane website address, without a path.");
  if (
    u.protocol !== "https:" &&
    !(development && u.protocol === "http:" && ["127.0.0.1", "localhost"].includes(u.hostname))
  )
    throw new Error("Lane requires HTTPS.");
  return u.origin;
}
function marketplaceUrl(value, marketplace) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      Boolean(MARKETPLACES[marketplace]?.hosts.includes(u.hostname))
    );
  } catch {
    return false;
  }
}
function cookieAllowed(cookie, marketplace) {
  const host = String(cookie.domain || "").replace(/^\./, "");
  return Boolean(MARKETPLACES[marketplace]?.hosts.includes(host));
}
function profileKey(owner, marketplace, accountId) {
  if (!MARKETPLACES[marketplace] || !owner || !accountId)
    throw new Error("Invalid account boundary.");
  return createHash("sha256")
    .update(JSON.stringify([owner, marketplace, accountId]))
    .digest("hex");
}
function createVault(directory, safeStorage) {
  function target(key) {
    if (!/^[a-z0-9-]{1,80}$/.test(key)) throw new Error("Invalid storage key.");
    return path.join(directory, key + ".vault");
  }
  function requireEncryption() {
    if (
      !safeStorage.isEncryptionAvailable() ||
      safeStorage.getSelectedStorageBackend?.() === "basic_text"
    )
      throw new Error("Windows protected storage is unavailable. Sessions were not saved.");
  }
  return {
    read(key) {
      requireEncryption();
      const file = target(key);
      if (!fs.existsSync(file)) return null;
      try {
        return JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
      } catch {
        throw new Error("Saved session could not be unlocked. Reconnect this account.");
      }
    },
    write(key, value) {
      requireEncryption();
      fs.mkdirSync(directory, { recursive: true });
      const file = target(key),
        temp = file + ".tmp";
      fs.writeFileSync(temp, safeStorage.encryptString(JSON.stringify(value)));
      fs.renameSync(temp, file);
    },
    remove(key) {
      for (const suffix of ["", ".tmp"]) fs.rmSync(target(key) + suffix, { force: true });
    },
  };
}
function diagnostics(state, version) {
  return {
    version,
    platform: process.platform,
    deviceId: state.deviceId,
    paired: Boolean(state.deviceToken),
    paused: Boolean(state.paused),
    lastSuccessfulAction: state.lastSuccessfulAction || null,
    profiles: (state.profiles || []).map((p) => ({
      marketplace: p.marketplace,
      status: p.status,
      lastSeen: p.lastSeen || null,
      lastSyncAt: p.lastSyncAt || null,
      validatedAt: p.validatedAt || null,
    })),
    error: state.errorCode || null,
  };
}
module.exports = {
  MARKETPLACES,
  laneOrigin,
  marketplaceUrl,
  cookieAllowed,
  profileKey,
  createVault,
  diagnostics,
};
