import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { approvePair } from "./desktop-devices";
export const approveDesktop = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string().uuid(), code: z.string().regex(/^[A-F0-9]{10}$/) }))
  .handler(async ({ context, data }) =>
    approvePair(await getSql(), context.userId, data.id, data.code),
  );
export const listDesktopDevices = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{
      id: string;
      label: string;
      version: string | null;
      last_seen_at: string | null;
      revoked_at: string | null;
      capabilities: { vinted?: string; ebay?: string; paused?: boolean };
    }>`select id,label,version,last_seen_at,revoked_at,capabilities from desktop_devices where user_id=${context.userId} order by created_at desc limit 20`;
  });
export const revokeDesktop = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`update desktop_devices set revoked_at=now(),access_hash=null where id=${data.id} and user_id=${context.userId}`;
    return { ok: true };
  });
