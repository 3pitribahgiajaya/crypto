"use strict";
const $=id=>document.getElementById(id), KEY="benai_paper_v1", CAPITAL=50000, FEE=0.003;
let timer=null, busy=false;
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
function load(){try{return JSON.parse(localStorage.getItem(KEY))||{cash:CAPITAL,realized:0,positions:{},history:[]}}catch{return {cash:CAPITAL,realized:0,positions:{},history:[]}}}
let state=load();
function save(){localStorage.setItem(KEY,JSON.stringify(state));render();}
function log(s){state.history.unshift({at:new Date().toLocaleString("id-ID"),text:s});state.history=state.history.slice(0,100);}
function render(){
 const open=Object.values(state.positions), used=open.reduce((a,p)=>a+p.entry*p.quantity,0);
 const unreal=open.reduce((a,p)=>a+(p.lastPrice-p.entry)*p.quantity-p.entry*p.quantity*FEE,0);
 $("equity").textContent=rupiah(state.cash+used+unreal);
 $("balance").innerHTML="Cash: "+rupiah(state.cash)+"<br>Open exposure: "+rupiah(used)+"<br>Realized P/L: "+rupiah(state.realized)+"<br>Unrealized P/L (fee est.): "+rupiah(unreal);
 $("history").innerHTML=state.history.length?state.history.map(x=>"<div>"+x.at+" · "+x.text+"</div>").join(""):"Belum ada transaksi paper.";
 for(const [s,id] of [["BTCIDR","btc"],["ETHIDR","eth"]]){
  const p=state.positions[s];$(id+"Position").textContent=p?"LONG "+p.quantity.toFixed(8)+" · Entry "+rupiah(p.entry)+" · TP "+rupiah(p.takeProfit)+" · SL "+rupiah(p.stopLoss):"Belum ada posisi.";
 }
}
async function candles(symbol){
 const now=Math.floor(Date.now()/1000),from=now-100*3600;
 const url="https://indodax.com/tradingview/history_v2?from="+from+"&symbol="+symbol+"&tf=60&to="+now;
 const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw Error("INDODAX candle HTTP "+r.status);
 const raw=await r.json(),rows=Array.isArray(raw)?raw:(raw.data||raw.result||[]);
 const data=rows.map(x=>({time:Number(x.Time??x.time),high:Number(x.High??x.high),low:Number(x.Low??x.low),close:Number(x.Close??x.close)}))
 .filter(x=>[x.time,x.high,x.low,x.close].every(Number.isFinite)&&x.time+3600<=now).sort((a,b)=>a.time-b.time);
 if(data.length<55)throw Error("Candle tertutup tidak cukup");
 return data;
}
async function evaluate(symbol,label){
 const data=await candles(symbol), last=data.at(-1), id=symbol==="BTCIDR"?"btc":"eth";
 $(id+"Price").textContent=rupiah(last.close);
 const existing=state.positions[symbol];
 const otherOpen=Object.keys(state.positions).some(k=>k!==symbol);
 if(!existing&&otherOpen){$(id+"Signal").textContent="WAIT · satu posisi paper aktif, exposure dibatasi";return;}
 const response=await fetch("https://ben-ai-indodax.jesimalango.workers.dev/paper/evaluate",{
  method:"POST",headers:{"content-type":"application/json","accept":"application/json"},
  body:JSON.stringify({symbol,candles:data,capital:CAPITAL,position:existing||null,feeRate:FEE,riskPct:1})
 });
 const result=await response.json();
 if(!response.ok||!result.ok)throw Error(result.error||"Paper backend tidak merespons");
 if(result.decision==="OPEN_LONG"){
  const p={...result.position,lastPrice:last.close};
  const cost=p.entry*p.quantity;
  if(cost>state.cash)throw Error("Saldo simulasi tidak cukup");
  state.cash-=cost;state.positions[symbol]=p;
  log(label+" OPEN LONG @ "+rupiah(p.entry)+" · Qty "+p.quantity.toFixed(8)+" · TP "+rupiah(p.takeProfit)+" · SL "+rupiah(p.stopLoss));
  $(id+"Signal").textContent="AUTO PAPER BACKEND: BUY SETUP · RSI "+result.rsi.toFixed(1);
 }else if(result.decision==="CLOSE_LONG"){
  const p=existing,pnl=Number(result.realizedPnl)||0;
  state.cash+=p.entry*p.quantity+pnl;state.realized+=pnl;delete state.positions[symbol];
  log(label+" CLOSE "+result.reason+" @ "+rupiah(result.exitPrice)+" · P/L "+rupiah(pnl));
  $(id+"Signal").textContent="AUTO PAPER BACKEND: "+result.reason+" · "+rupiah(pnl);
 }else if(result.decision==="HOLD_LONG"){
  existing.lastPrice=last.close;
  $(id+"Signal").textContent="HOLD LONG · RSI "+result.rsi.toFixed(1);
 }else{
  $(id+"Signal").textContent=result.decision+" · RSI "+result.rsi.toFixed(1)+" · "+result.reason;
 }
}
async function tick(){
 if(busy)return;busy=true;
 try{await Promise.all([evaluate("BTCIDR","BTC/IDR"),evaluate("ETHIDR","ETH/IDR")]);$("status").textContent="Pemeriksaan terakhir: "+new Date().toLocaleTimeString("id-ID")+" · candle tertutup INDODAX";save();}
 catch(e){$("status").textContent="Data belum tersedia: "+e.message+" · mencoba lagi otomatis.";}
 finally{busy=false;}
}
$("start").onclick=()=>{if(timer)return; $("engineStatus").textContent="AUTO PAPER RUNNING";$("status").textContent="Mesin simulasi aktif. Tidak ada order live.";tick();timer=setInterval(tick,60000)};
$("stop").onclick=()=>{clearInterval(timer);timer=null;$("engineStatus").textContent="STOPPED";$("status").textContent="Mesin dihentikan."};
$("reset").onclick=()=>{if(!confirm("Hapus seluruh saldo, posisi, dan riwayat simulasi?"))return;state={cash:CAPITAL,realized:0,positions:{},history:[]};save()};
render();
