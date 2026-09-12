declare const __LANE_BUILD__: { version: string; commit: string; builtAt: string; dirty: boolean };
export const BUILD =
  typeof __LANE_BUILD__ === "undefined"
    ? { version: "unknown", commit: "unknown", builtAt: null, dirty: true }
    : __LANE_BUILD__;
