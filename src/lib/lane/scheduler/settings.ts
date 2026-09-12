import { z } from "zod";
import { SYSTEM_CAPS, type Policy } from "./policy.ts";
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const limits = {
  hourly: z.number().int().min(1).max(30),
  daily: z.number().int().min(1).max(100),
  batchSize: z.number().int().min(1).max(50),
};
const override = z.object(limits).partial().strict();
export const settingsSchema = z
  .object({
    enabled: z.boolean(),
    timezone: z
      .string()
      .max(80)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en-GB", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Valid IANA timezone required"),
    minSeconds: z.number().int().min(60).max(3600),
    maxSeconds: z.number().int().min(60).max(3600),
    ...limits,
    activeStart: time,
    activeEnd: time,
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    quietEnabled: z.boolean(),
    quietStart: time,
    quietEnd: time,
    batchPauseEvery: z.number().int().min(1).max(50),
    batchPauseSeconds: z.number().int().min(0).max(7200),
    maxConsecutiveFailures: z.number().int().min(1).max(5),
    maxBatchFailures: z.number().int().min(1).max(10),
    maxAuthFailures: z.number().int().min(1).max(3),
    maxWarnings: z.number().int().min(1).max(3),
    retryLimit: z.number().int().min(0).max(3),
    retryBackoff: z.array(z.number().int().min(30).max(3600)).length(3),
    confirmAbove: z.number().int().min(1).max(50),
    imagePreset: z.enum(["ORIGINAL", "CLEAN_EXPORT"]),
    overrides: z.object({ ebay_uk: override, vinted_uk: override }).strict(),
  })
  .strict()
  .refine((s) => s.minSeconds <= s.maxSeconds, "Maximum interval must follow minimum")
  .refine((s) => s.activeStart !== s.activeEnd, "Active hours must have a start and end")
  .refine(
    (s) => !s.quietEnabled || s.quietStart !== s.quietEnd,
    "Quiet hours must have a start and end",
  );
export type SchedulerSettings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: SchedulerSettings = {
  enabled: false,
  timezone: "Europe/London",
  minSeconds: 300,
  maxSeconds: 300,
  hourly: 12,
  daily: 50,
  batchSize: 10,
  activeStart: "09:00",
  activeEnd: "20:00",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  quietEnabled: false,
  quietStart: "23:00",
  quietEnd: "07:00",
  batchPauseEvery: 10,
  batchPauseSeconds: 900,
  maxConsecutiveFailures: 3,
  maxBatchFailures: 5,
  maxAuthFailures: 1,
  maxWarnings: 1,
  retryLimit: 3,
  retryBackoff: [30, 120, 600],
  confirmAbove: 20,
  imagePreset: "ORIGINAL",
  overrides: { ebay_uk: {}, vinted_uk: {} },
};
export function effectiveCaps(
  s: SchedulerSettings,
  p: Policy,
  marketplace: "ebay_uk" | "vinted_uk",
) {
  const o = s.overrides[marketplace];
  return {
    minSeconds: Math.max(SYSTEM_CAPS.minSeconds, p.minSeconds, s.minSeconds),
    maxSeconds: Math.max(p.minSeconds, s.maxSeconds),
    hourly: Math.min(SYSTEM_CAPS.hourly, p.hourly, s.hourly, o.hourly ?? Infinity),
    daily: Math.min(SYSTEM_CAPS.daily, p.daily, s.daily, o.daily ?? Infinity),
    batchSize: Math.min(SYSTEM_CAPS.batchSize, p.batchSize, s.batchSize, o.batchSize ?? Infinity),
  };
}
export function intervalSeconds(min: number, max: number, random = Math.random) {
  return min + Math.floor(Math.max(0, Math.min(0.999999, random())) * (max - min + 1));
}
const fmt = new Map<string, Intl.DateTimeFormat>();
export function localClock(at: Date, timezone: string) {
  let f = fmt.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    fmt.set(timezone, f);
  }
  const parts = Object.fromEntries(f.formatToParts(at).map((p) => [p.type, p.value]));
  return {
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday),
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const inWindow = (n: number, start: string, end: string) =>
  minutes(start) < minutes(end)
    ? n >= minutes(start) && n < minutes(end)
    : n >= minutes(start) || n < minutes(end);
export function permittedTime(at: Date, s: SchedulerSettings) {
  const t = localClock(at, s.timezone);
  return (
    s.weekdays.includes(t.day) &&
    inWindow(t.minute, s.activeStart, s.activeEnd) &&
    (!s.quietEnabled || !inWindow(t.minute, s.quietStart, s.quietEnd))
  );
}
export function nextAllowed(at: Date, s: SchedulerSettings): Date {
  if (permittedTime(at, s)) return at;
  const start = Math.ceil(at.getTime() / 60000) * 60000;
  for (let t = start; t <= start + 8 * 86400000; t += 60000) {
    const d = new Date(t);
    if (permittedTime(d, s)) return d;
  }
  throw Error("NO_ACTIVE_WINDOW");
}
export function retryAfterMs(value: string | null, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}
