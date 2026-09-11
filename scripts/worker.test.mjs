import test from "node:test";
import assert from "node:assert/strict";
import { runWorker } from "../src/lib/lane/server/worker.ts";

test("worker fails closed before reading jobs without its dedicated secret", async () => {
  const sql=()=>{throw new Error("Database must not be queried");};
  const deps={pollOrders:()=>{throw new Error("Orders must not be read before authentication");}};
  assert.equal((await runWorker(new Request("https://lane.test/api/worker"),sql,undefined,deps)).status,503);
  assert.equal((await runWorker(new Request("https://lane.test/api/worker",{headers:{authorization:"Bearer wrong"}}),sql,"x".repeat(32),deps)).status,401);
});

test("worker preserves each job owner and reports successful work without exposing identifiers", async () => {
  let reads=0; const recovered=[],processed=[];
  const sql=async()=>++reads===1?[{user_id:"seller-one"},{user_id:"seller-two"}]:[{id:"a",user_id:"seller-one"},{id:"b",user_id:"seller-two"}];
  const response=await runWorker(new Request("https://lane.test/api/worker",{headers:{authorization:`Bearer ${"x".repeat(32)}`}}),sql,"x".repeat(32),{
    pollOrders:async()=>assert.equal(reads,0,"sale outbox must exist before listing jobs are selected"),
    recover:async(_,user)=>recovered.push(user),
    process:async(_,user,id,source)=>{processed.push([user,id,source]);return {ok:id==="a"};},
  });
  assert.deepEqual(recovered,["seller-one","seller-two"]);
  assert.deepEqual(processed,[["seller-one","a","worker"],["seller-two","b","worker"]]);
  assert.deepEqual(await response.json(),{attempted:2,completed:1});
  assert.equal(response.headers.get("cache-control"),"no-store");
});
