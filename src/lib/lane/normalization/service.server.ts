import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "../../db.ts";
import { localPhoto } from "../photos.ts";
import { normalizationSchema } from "./options.ts";
import { normalizeImage } from "./engine.server.ts";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export class NormalizationService {
  private sql: Sql;
  private enabled: boolean;
  constructor(sql: Sql, enabled: boolean) {
    this.sql = sql;
    this.enabled = enabled;
  }
  async queue(user: string, photoIds: string[], raw: unknown, requestKey: string) {
    if (!this.enabled) throw Error("IMAGE_NORMALIZATION_DISABLED");
    const options = normalizationSchema.parse(raw);
    if (options.preset === "WHITE_BACKGROUND") throw Error("BACKGROUND_REPLACEMENT_UNSUPPORTED");
    if (
      !photoIds.length ||
      photoIds.length > 12 ||
      new Set(photoIds).size !== photoIds.length ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(requestKey)
    )
      throw Error("INVALID_IMAGE_BATCH");
    return this.sql.transaction(async (tx) => {
      if (!(await tx`select user_id from user_settings where user_id=${user} for update`).length)
        throw Error("ACCOUNT_NOT_FOUND");
      const keys = photoIds.map((_, i) => requestKey + ":" + i),
        existing = await tx<{
          id: string;
          request_key: string;
          fingerprint: string;
        }>`select id,request_key,fingerprint from image_normalizations where user_id=${user} and request_key=any(${keys}::text[])`;
      const fingerprint = hash(JSON.stringify({ photoIds, options }));
      if (existing.length) {
        if (
          existing.length !== photoIds.length ||
          existing.some((e) => e.fingerprint !== fingerprint)
        )
          throw Error("IDEMPOTENCY_CONFLICT");
        return keys.map((k) => existing.find((e) => e.request_key === k)!.id);
      }
      const [count] = await tx<{
        n: number;
      }>`select count(*)::int n from image_normalizations where user_id=${user} and review<>'deleted'`;
      if (count.n + photoIds.length > 50) throw Error("DERIVATIVE_STORAGE_LIMIT");
      const ids: string[] = [];
      for (const [i, photo] of photoIds.entries()) {
        const [source] = await tx<{
          url: string;
        }>`select url from item_photos where id=${photo} and user_id=${user}`;
        if (!source) throw Error("PHOTO_NOT_FOUND");
        if (!localPhoto(source.url)) throw Error("LOCAL_ORIGINAL_REQUIRED");
        const id = randomUUID();
        ids.push(id);
        await tx`insert into image_normalizations(id,user_id,source_photo_id,derivative_photo_id,source_hash,request_key,fingerprint,preset,options,status) values(${id},${user},${photo},${randomUUID()},${hash(source.url)},${keys[i]},${fingerprint},${options.preset},${JSON.stringify(options)}::jsonb,'QUEUED')`;
      }
      return ids;
    });
  }
  async run(user: string, id: string) {
    if (!this.enabled) throw Error("IMAGE_NORMALIZATION_DISABLED");
    const claim = await this.sql.transaction(async (tx) => {
      const [j] = await tx<{
        source_photo_id: string;
        source_hash: string;
        options: unknown;
        status: string;
      }>`select source_photo_id,source_hash,options,status from image_normalizations where id=${id} and user_id=${user} for update`;
      if (!j) throw Error("IMAGE_JOB_NOT_FOUND");
      if (j.status !== "QUEUED") return null;
      const [p] = await tx<{
        url: string;
      }>`select url from item_photos where id=${j.source_photo_id} and user_id=${user}`;
      const parsed = p && localPhoto(p.url);
      if (!parsed || hash(p.url) !== j.source_hash) {
        await tx`update image_normalizations set status='FAILED',last_error='SOURCE_CHANGED' where id=${id}`;
        return null;
      }
      await tx`update image_normalizations set status='RUNNING',lease_expires_at=now()+interval '2 minutes' where id=${id}`;
      return { options: j.options, input: Buffer.from(parsed.base64, "base64") };
    });
    if (!claim) return;
    try {
      const out = await normalizeImage(claim.input, claim.options);
      await this
        .sql`update image_normalizations set status='SUCCEEDED',completed_at=now(),lease_expires_at=null,width=${out.width},height=${out.height},format=${out.format},file_size=${out.size},processing_version=${out.version},output_data=${"data:image/" + out.format + ";base64," + out.data.toString("base64")} where id=${id} and user_id=${user} and status='RUNNING' and lease_expires_at>now()`;
    } catch (e) {
      const safe = [
        "IMAGE_SIZE_LIMIT",
        "IMAGE_FORMAT_UNSUPPORTED",
        "OUTPUT_TOO_LARGE",
        "TRANSPARENCY_NEEDS_EXPLICIT_BACKGROUND",
        "BACKGROUND_REPLACEMENT_UNSUPPORTED",
      ];
      const code =
        e instanceof Error && safe.includes(e.message) ? e.message : "IMAGE_PROCESSING_FAILED";
      await this
        .sql`update image_normalizations set status='FAILED',last_error=${code},completed_at=now(),lease_expires_at=null where id=${id} and user_id=${user} and status='RUNNING'`;
    }
  }
  async review(user: string, id: string, decision: "accepted" | "rejected" | "deleted") {
    await this.sql.transaction(async (tx) => {
      const [j] = await tx<{
        source_photo_id: string;
        source_hash: string;
        status: string;
      }>`select source_photo_id,source_hash,status from image_normalizations where id=${id} and user_id=${user} and review<>'deleted' for update`;
      if (!j) throw Error("IMAGE_JOB_NOT_FOUND");
      if (decision !== "deleted" && j.status !== "SUCCEEDED") throw Error("IMAGE_NOT_READY");
      if (decision === "accepted") {
        const [p] = await tx<{
          url: string;
        }>`select url from item_photos where id=${j.source_photo_id} and user_id=${user}`;
        if (!p || hash(p.url) !== j.source_hash) throw Error("SOURCE_CHANGED");
      }
      await tx`update image_normalizations set review=${decision},status=case when ${decision}='deleted' and status in('QUEUED','RUNNING') then 'CANCELLED' else status end,output_data=case when ${decision}='deleted' then null else output_data end where id=${id} and user_id=${user}`;
    });
  }
  async state(user: string) {
    await this
      .sql`update image_normalizations set status='FAILED',last_error='PROCESS_INTERRUPTED',lease_expires_at=null where user_id=${user} and status='RUNNING' and lease_expires_at<now()`;
    const jobs = await this.sql<{
      id: string;
      source_photo_id: string;
      derivative_photo_id: string;
      preset: string;
      status: string;
      review: string;
      created_at: string;
      width: number | null;
      height: number | null;
      format: string | null;
      file_size: number | null;
      processing_version: string | null;
      last_error: string | null;
    }>`select id,source_photo_id,derivative_photo_id,preset,status,review,created_at,width,height,format,file_size,processing_version,last_error from image_normalizations where user_id=${user} and review<>'deleted' order by created_at desc limit 50`;
    const photos = await this.sql<{
      id: string;
      item_id: string;
      url: string;
      title: string;
    }>`select p.id,p.item_id,p.url,i.title from item_photos p join items i on i.id=p.item_id and i.user_id=p.user_id where p.user_id=${user} order by i.updated_at desc,p.sort_order limit 100`;
    return { enabled: this.enabled, jobs, photos };
  }
  async image(user: string, id: string) {
    const [row] = await this.sql<{
      output_data: string | null;
    }>`select output_data from image_normalizations where id=${id} and user_id=${user} and status='SUCCEEDED' and review<>'deleted'`;
    if (!row?.output_data) throw Error("DERIVATIVE_NOT_FOUND");
    return row.output_data;
  }
}
