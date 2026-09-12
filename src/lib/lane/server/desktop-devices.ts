import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Sql } from "../../db";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");
export const beginPairSchema = z
  .object({ deviceId: z.string().uuid(), challenge: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export async function beginPair(sql: Sql, input: z.infer<typeof beginPairSchema>) {
  const data = beginPairSchema.parse(input),
    id = randomUUID(),
    code = randomBytes(5).toString("hex").toUpperCase();
  await sql.transaction(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('lane-desktop-pairing-cap'))`;
    const count = await tx<{
      n: number;
    }>`select count(*)::int as n from desktop_pairings where expires_at>now() and consumed_at is null`;
    if (count[0].n >= 200) throw new Error("Pairing is busy. Try again later.");
    await tx`insert into desktop_pairings(id,device_id,challenge,code_hash) values(${id},${data.deviceId},${data.challenge},${hash(code)})`;
  });
  return { id, code, expiresIn: 600 };
}
export async function approvePair(sql: Sql, userId: string, id: string, code: string) {
  const rows =
    await sql`update desktop_pairings set user_id=${userId} where id=${id} and code_hash=${hash(code)} and expires_at>now() and consumed_at is null and (user_id is null or user_id=${userId}) returning id`;
  if (!rows.length)
    throw new Error("Pairing expired or was already claimed. Start again from Lane Desktop.");
  return { ok: true };
}
export async function exchangePair(sql: Sql, id: string, verifier: string) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) throw new Error("Invalid pairing verifier.");
  return sql.transaction(async (tx) => {
    const rows = await tx<{
      device_id: string;
      user_id: string | null;
    }>`select device_id,user_id from desktop_pairings where id=${id} and challenge=${hash(verifier)} and expires_at>now() and consumed_at is null for update`;
    if (!rows.length) throw new Error("Pairing expired. Start again from Lane Desktop.");
    if (!rows[0].user_id) return { pending: true as const };
    const deviceId = randomUUID(),
      refreshToken = token(),
      accessToken = token();
    await tx`insert into desktop_devices(id,user_id,refresh_hash,refresh_expires_at,access_hash,access_expires_at)
   values(${deviceId},${rows[0].user_id},${hash(refreshToken)},now()+interval '30 days',${hash(accessToken)},now()+interval '15 minutes')`;
    await tx`update desktop_pairings set consumed_at=now() where id=${id}`;
    return {
      pending: false as const,
      deviceId,
      userId: rows[0].user_id,
      refreshToken,
      accessToken,
      expiresIn: 900,
    };
  });
}
export async function refreshDevice(sql: Sql, refreshToken: string) {
  const accessToken = token();
  const rows = await sql<{
    id: string;
    user_id: string;
  }>`update desktop_devices set access_hash=${hash(accessToken)},access_expires_at=now()+interval '15 minutes'
 where refresh_hash=${hash(refreshToken)} and revoked_at is null and refresh_expires_at>now() returning id,user_id`;
  if (!rows.length) throw new Error("Device pairing expired or was revoked. Pair again.");
  return { accessToken, expiresIn: 900 };
}
export async function revokeDeviceToken(sql: Sql, refreshToken: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(refreshToken)) throw new Error("Invalid device request.");
  await sql`update desktop_devices set revoked_at=coalesce(revoked_at,now()),access_hash=null where refresh_hash=${hash(refreshToken)}`;
  return { ok: true };
}
export async function resolveDevice(sql: Sql, accessToken: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(accessToken)) return null;
  const rows = await sql<{
    id: string;
    user_id: string;
  }>`select id,user_id from desktop_devices where access_hash=${hash(accessToken)} and access_expires_at>now() and refresh_expires_at>now() and revoked_at is null`;
  return rows[0] || null;
}
export const heartbeatSchema = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    paused: z.boolean(),
    vinted: z.enum(["unknown", "authenticated", "needs_reauth", "needs_attention"]),
    ebay: z.enum(["unknown", "authenticated", "needs_reauth", "needs_attention"]),
  })
  .strict();
export async function heartbeatDevice(sql: Sql, accessToken: string, value: unknown) {
  const body = heartbeatSchema.parse(value),
    device = await resolveDevice(sql, accessToken);
  if (!device) throw new Error("Device is not authorized.");
  await sql`update desktop_devices set version=${body.version},last_seen_at=now(),capabilities=${JSON.stringify(body)}::jsonb where id=${device.id} and user_id=${device.user_id} and revoked_at is null`;
  return { ok: true };
}
