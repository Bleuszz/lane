import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source = ts
  .transpileModule(readFileSync("src/lib/lane/measurement.ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  })
  .outputText.replaceAll("export ", "")
  .replaceAll("import.meta.env.VITE_LANE_ANALYTICS_ENABLED", "featureFlag");
function run({
  consent = "yes",
  gpc = false,
  dnt = "0",
  enabled = "true",
  event = "signup_completed",
} = {}) {
  const calls = [];
  const context = {
    window: {},
    navigator: { globalPrivacyControl: gpc, doNotTrack: dnt },
    localStorage: { getItem: () => consent },
    featureFlag: enabled,
    fetch: (...args) => {
      calls.push(args);
      return Promise.resolve();
    },
  };
  vm.createContext(context);
  vm.runInContext(source + ";measure(" + JSON.stringify(event) + ");", context);
  return calls;
}
test("measurement requires opt-in, respects privacy signals and accepts only event names", () => {
  for (const args of [
    { consent: null },
    { consent: "no" },
    { gpc: true },
    { dnt: "1" },
    { enabled: "false" },
    { event: "private@email.example" },
  ])
    assert.equal(run(args).length, 0);
  const calls = run();
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0][1].body), { event: "signup_completed" });
  assert.equal(calls[0][1].credentials, "omit");
  assert.equal(calls[0][1].referrerPolicy, "no-referrer");
});
