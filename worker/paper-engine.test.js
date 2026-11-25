import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePaperSignal } from "./paper-engine.js";
const candles=(start=100,step=0.5,n=80)=>Array.from({length:n},(_,i)=>({time:1700000000+i*3600,close:start+i*step,high:start+i*step+1,low:start+i*step-1}));
test("paper engine opens long only on bullish confirmed setup and stays within 50k budget",()=>{
 const r=evaluatePaperSignal({symbol:"BTCIDR",candles:candles(),capital:50000});
 assert.equal(r.decision,"OPEN_LONG");assert.ok(r.position.quantity*r.position.entry<=25000);assert.ok(r.position.stopLoss<r.position.entry);assert.ok(r.position.takeProfit>r.position.entry);
});
test("paper engine rejects capital above user budget",()=>assert.throws(()=>evaluatePaperSignal({symbol:"BTCIDR",candles:candles(),capital:50001}),/maksimum Rp50.000/));
test("paper engine rejects unsupported pair",()=>assert.throws(()=>evaluatePaperSignal({symbol:"DOGEIDR",candles:candles()}),/Pair tidak didukung/));
test("paper engine conservatively closes at stop when same candle touches TP and SL",()=>{
 const base=candles(); const entry=base.at(-1).close;
 base[base.length-1]={time:base.at(-1).time,close:entry,high:entry+100,low:entry-100};
 const p={symbol:"BTCIDR",side:"LONG",entry,stopLoss:entry-10,takeProfit:entry+10,quantity:0.001,capitalAtEntry:50000,openedAt:base.at(-2).time};
 const r=evaluatePaperSignal({symbol:"BTCIDR",candles:base,capital:50000,position:p});
 assert.equal(r.decision,"CLOSE_LONG");assert.equal(r.reason,"STOP_LOSS");
});
test("paper engine holds an open position while TP and SL untouched",()=>{
 const c=candles();const entry=c.at(-1).close;
 const p={symbol:"BTCIDR",side:"LONG",entry,stopLoss:entry-10,takeProfit:entry+10,quantity:0.001,capitalAtEntry:50000,openedAt:c.at(-2).time};
 assert.equal(evaluatePaperSignal({symbol:"BTCIDR",candles:c,capital:50000,position:p}).decision,"HOLD_LONG");
});
