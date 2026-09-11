import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { cookieMetadata, profileDiagnostics } = createRequire(import.meta.url)(
  "../desktop/session-diagnostics.cjs",
);
test("probe serializes cookie metadata and gate evidence without cookie values, page text or identity", () => {
  const cookie = {
    name: "fixture",
    domain: ".ebay.co.uk",
    path: "/",
    secure: true,
    httpOnly: true,
    session: true,
    value: "PRIVATE_COOKIE",
    authorization: "PRIVATE_AUTH",
  };
  const output = JSON.stringify({
    cookies: cookieMetadata([cookie]),
    profile: profileDiagnostics({
      marketplace: "ebay_uk",
      status: "ERROR",
      identity: "PRIVATE_OWNER",
      diagnostic: {
        stage: "AUTH_VALIDATION_FAILED",
        backgroundPage: {
          identity: "PRIVATE_OWNER",
          html: "PRIVATE_BODY",
          cookies: [cookie],
          signals: { header: true, token: "PRIVATE_TOKEN" },
        },
      },
    }),
  });
  assert(!output.includes("PRIVATE_"));
  assert(output.includes("AUTH_VALIDATION_FAILED"));
});
