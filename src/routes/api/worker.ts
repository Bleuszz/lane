import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { runWorker } from "@/lib/lane/server/worker";
import { processJob, liveEbayToken } from "@/lib/lane/server/process";
import { pollEbayOrders } from "@/lib/lane/server/ebay-orders";
import { ebayFetch } from "@/lib/lane/server/ebay";
import { ebayEnv } from "@/lib/lane/server/secret";
import { recoverExpiredJobs } from "@/lib/lane/server/operations";

async function handle({request}:{request:Request}) {
  return runWorker(request,await getSql(),process.env.LANE_WORKER_SECRET,{
    recover:recoverExpiredJobs,process:processJob,
    pollOrders:process.env.LANE_EBAY_ORDER_POLLING === "true" ? sql=>pollEbayOrders(sql,ebayEnv(),{
      token:liveEbayToken,fetchPage:(access,path)=>ebayFetch(access,"GET",path),
    }) : undefined,
  });
}
export const Route = createFileRoute("/api/worker")({server:{handlers:{GET:handle,POST:handle}}});
