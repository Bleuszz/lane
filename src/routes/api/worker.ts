import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { runWorker } from "@/lib/lane/server/worker";
import { processJob } from "@/lib/lane/server/process";
import { recoverExpiredJobs } from "@/lib/lane/server/operations";

async function handle({request}:{request:Request}) {
  return runWorker(request,await getSql(),process.env.LANE_WORKER_SECRET,{recover:recoverExpiredJobs,process:processJob});
}
export const Route = createFileRoute("/api/worker")({server:{handlers:{GET:handle,POST:handle}}});
