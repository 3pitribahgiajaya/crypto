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
 const data=await candles(symbol), closes=data.map(x=>x.close),last=data.at(-1);
 const ema=(a,n)=>{if(a.length<n)return null;let v=a.slice(0,n).reduce((x,y)=>x+y,0)/n,k=2/(n+1);for(let i=n;i<a.length;i++)v=a[i]*k+v*(1-k);return v};
 let gains=0,loss=0;for(let i=closes.length-14;i<closes.length;i++){let d=closes[i]-closes[i-1];if(d>0)gains+=d;else loss-=d}
 const rsi=loss===0?100:100-100/(1+gains/loss);
 const trs=[];for(let i=1;i<data.length;i++){let c=data[i],p=data[i-1];trs.push(Math.max(c.high-c.low,Math.abs(c.high-p.close),Math.abs(c.low-p.close)))}
 const atr=trs.slice(-14).reduce((a,b)=>a+b,0)/14,e9=ema(closes,9),e21=ema(closes,21);
 const elabel=symbol==="BTCIDR"?"btc":"eth";$(elabel+"Price").textContent=rupiah(last.close);
 const position=state.positions[symbol];
 if(position){
  position.lastPrice=last.close;
  let exit=null,reason="";
  if(last.low<=position.stopLoss){exit=position.stopLoss;reason="STOP LOSS"}
  else if(last.high>=position.takeProfit){exit=position.takeProfit;reason="TAKE PROFIT"}
  if(exit!==null){
   const gross=(exit-position.entry)*position.quantity,fees=(position.entry+exit)*position.quantity*FEE,pnl=gross-fees;
   state.cash+=position.entry*position.quantity+pnl;state.realized+=pnl;delete state.positions[symbol];log(label+" CLOSE "+reason+" @ "+rupiah(exit)+" · P/L "+rupiah(pnl));
   $(elabel+"Signal").textContent="AUTO PAPER: "+reason+" · "+rupiah(pnl);
  }else $(elabel+"Signal").textContent="HOLD LONG · RSI "+rsi.toFixed(1);
 }else if(e9>e21&&rsi>=50&&rsi<=68&&last.close>=e9){
  const exposure=Object.values(state.positions).reduce((a,p)=>a+p.entry*p.quantity,0);
  const budget=Math.min(state.cash,Math.max(0,CAPITAL*0.5-exposure));
  const stop=last.close-1.5*atr,target=last.close+3*atr,riskBudget=(state.cash+exposure)*0.01;
  const qty=Math.min(budget/(last.close*(1+FEE)),riskBudget/(last.close-stop));
  if(qty*last.close>=10000){
   state.cash-=qty*last.close;state.positions[symbol]={entry:last.close,quantity:qty,stopLoss:stop,takeProfit:target,lastPrice:last.close,openedAt:Date.now()};
   log(label+" OPEN LONG @ "+rupiah(last.close)+" · Qty "+qty.toFixed(8)+" · TP "+rupiah(target)+" · SL "+rupiah(stop));
   $(elabel+"Signal").textContent="AUTO PAPER: BUY SETUP · RSI "+rsi.toFixed(1);
  }else $(elabel+"Signal").textContent="WAIT · modal minimum/exposure belum cukup";
 }else $(elabel+"Signal").textContent=(e9<e21&&rsi<45?"EXIT WARNING":"WAIT")+" · RSI "+rsi.toFixed(1);
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
