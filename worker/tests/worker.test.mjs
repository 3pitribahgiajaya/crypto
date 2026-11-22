import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../index.js";

const env = {
  BEN_DASH_TOKEN: "test-dashboard-token",
  INDODAX_API_KEY: "test-api-key",
  INDODAX_API_SECRET: "test-api-secret",
  BEN_LIVE_TRADING_ENABLED: "true",
  BEN_MAX_ORDER_QTY: "0.0001",
  BEN_MAX_MARKET_BUY_IDR: "50000"
};
const auth = {Authorization:"Bearer test-dashboard-token","Content-Type":"application/json"};
const request = (path, body, headers=auth) => new Request("https://worker.test"+path,{method:body?"POST":"GET",headers,body:body?JSON.stringify(body):undefined});
const originalFetch = globalThis.fetch;
const originalCrypto = globalThis.crypto;

test.beforeEach(() => { globalThis.crypto=webcrypto; });
test.afterEach(() => { globalThis.fetch=originalFetch; globalThis.crypto=originalCrypto; });

test("health reports approval required and withdrawals disabled", async () => {
  const r=await worker.fetch(new Request("https://worker.test/health"),env);
  const d=await r.json();
  assert.equal(r.status,200); assert.equal(d.approvalRequired,true); assert.equal(d.withdrawals,false);
});

test("private endpoints reject missing bearer token", async () => {
  const r=await worker.fetch(request("/account",null,{}),env);
  assert.equal(r.status,401);
});

test("order cannot reach exchange without explicit approval", async () => {
  let called=false; globalThis.fetch=async()=>{called=true;return new Response('{"code":0}',{status:200});};
  const r=await worker.fetch(request("/order",{symbol:"BTCIDR",side:"BUY",type:"MARKET",quoteOrderQty:50000}),env);
  const d=await r.json();
  assert.equal(r.status,428); assert.equal(d.approvalRequired,true); assert.equal(called,false);
});

test("wrong approval phrase is rejected without exchange call", async () => {
  let called=false; globalThis.fetch=async()=>{called=true;return new Response('{"code":0}',{status:200});};
  const r=await worker.fetch(request("/order",{symbol:"BTCIDR",side:"BUY",type:"MARKET",quoteOrderQty:50000,approvalConfirmed:true,approvalPhrase:"SETUJUI SEMUA"}),env);
  assert.equal(r.status,428); assert.equal(called,false);
});

test("correct approval sends a market BUY with quoteOrderQty", async () => {
  let sentBody="";
  globalThis.fetch=async(url,init)=>{assert.match(String(url),/api\/v2\/order$/);sentBody=init.body;return new Response('{"code":0,"success":true}',{status:200});};
  const r=await worker.fetch(request("/order",{symbol:"BTCIDR",side:"BUY",type:"MARKET",quoteOrderQty:50000,approvalConfirmed:true,approvalPhrase:"SETUJUI BUY BTCIDR MARKET IDR 50000"}),env);
  const d=await r.json();
  assert.equal(r.status,200); assert.equal(d.success,true); assert.match(sentBody,/quoteOrderQty=50000/); assert.doesNotMatch(sentBody,/quantity=/);
});

test("market BUY above configured IDR cap is rejected", async () => {
  let called=false; globalThis.fetch=async()=>{called=true;return new Response('{"code":0}',{status:200});};
  const r=await worker.fetch(request("/order",{symbol:"BTCIDR",side:"BUY",type:"MARKET",quoteOrderQty:50001,approvalConfirmed:true,approvalPhrase:"SETUJUI BUY BTCIDR MARKET IDR 50001"}),env);
  assert.equal(r.status,400); assert.equal(called,false);
});

test("unsupported symbols are rejected", async () => {
  const r=await worker.fetch(request("/order",{symbol:"DOGEIDR",side:"BUY",type:"MARKET",quoteOrderQty:10000}),env);
  assert.equal(r.status,400);
});
