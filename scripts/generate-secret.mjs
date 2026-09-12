import { randomBytes } from "node:crypto";
// Deliberate secret output for direct local copy into the provider dashboard. Never redirect to Git.
process.stdout.write(randomBytes(32).toString("hex") + "\n");
