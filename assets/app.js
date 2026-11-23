"use strict";
const $=id=>document.getElementById(id), fmt=(n,d=2)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:d}).format(n), usd=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:n<1?6:2}).format(n);
const coins=[["Bitcoin","bitcoin","BTC","BTCUSDT"],["Ethereum","ethereum","ETH","ETHUSDT"],["BNB","binancecoin","BNB","BNBUSDT"],["Polygon","matic-network","POL","POLUSDT"],["Solana","solana","SOL","SOLUSDT"]];
const chains={"1":"Ethereum","137":"Polygon","42161":"Arbitrum One","8453":"Base","56":"BNB Smart Chain"};
let market={}, alertEnabled=false, lastSignals={};
async function getJSON(url){const r=await fetch(url,{headers:{accept:"application/json"}});if(!r.ok)throw Error("HTTP "+r.status);return r.json()}
const binanceHosts=["https://api.binance.com","https://api1.binance.com"];
async function binanceJSON(path){let last;for(const host of binanceHosts){try{return await getJSON(host+path)}catch(e){last=e}}throw last||Error("Market API unavailable")}
async function loadMarket(){
  $("market").innerHTML='<p class="muted">Memuat harga pasar…</p>';
  const results=await Promise.all(coins.map(async([name,id,sym,pair])=>{
    try{
      const x=await binanceJSON("/api/v3/ticker/24hr?symbol="+pair);
      return {id,name,sym,price:Number(x.lastPrice),change:Number(x.priceChangePercent)};
    }catch(e){return {id,name,sym,error:String(e.message||e)}}
  }));
  market=Object.fromEntries(results.filter(x=>Number.isFinite(x.price)&&x.price>0).map(x=>[x.id,{usd:x.price,usd_24h_change:x.change}]));
  $("market").innerHTML=results.map(x=>x.price>0
    ?'<div class="market-row"><div><b>'+x.name+'</b><small class="muted">'+x.sym+'</small></div><div class="coin-price">'+usd(x.price)+'<small class="'+(x.change>=0?"up":"down")+'">'+(x.change>=0?"+":"")+fmt(x.change,2)+'%</small></div></div>'
    :'<div class="market-row"><div><b>'+x.name+'</b><small class="muted">'+x.sym+'</small></div><div class="coin-price">Unavailable</div></div>'
  ).join("");
  const count=Object.keys(market).length;
  $("marketStatus").textContent="Binance Spot public data · "+count+"/"+coins.length+" aset tersedia · USDT sebagai pendekatan USD; bukan harga eksekusi.";
  $("engineStatus").textContent=count?"MARKET DATA "+count+"/"+coins.length:"DATA UNAVAILABLE";
  await loadSignals();
}

async function loadIndodax(){
  const target=$("indodaxMarket");
  if(!target)return;
  target.innerHTML='<p class="muted">Mengambil ticker publik INDODAX…</p>';
  try{
    const data=await getJSON("https://indodax.com/api/tickers");
    const tickers=data.tickers||data;
    const rows=[
      ["Bitcoin","BTC","btcidr"],["Ethereum","ETH","ethidr"],
      ["Solana","SOL","solidr"],["BNB","BNB","bnbidr"],["Polygon","POL","polidr"]
    ];
    target.innerHTML=rows.map(([name,sym,key])=>{
      const t=tickers[key];
      if(!t||!Number(t.last))return '<div class="market-row"><div><b>'+name+' · '+sym+'/IDR</b></div><div class="coin-price">Pair tidak tersedia</div></div>';
      const change=t.change_24h!=null?Number(t.change_24h):null;
      return '<div class="market-row"><div><b>'+name+'</b><small class="muted">'+sym+'/IDR · INDODAX</small></div><div class="coin-price">Rp '+fmt(Number(t.last),Number(t.last)<1?6:0)+(Number.isFinite(change)?'<small class="'+(change>=0?'up':'down')+'">'+(change>=0?'+':'')+fmt(change,2)+'%</small>':'')+'</div></div>';
    }).join("");
    $("indodaxStatus").textContent="Ticker publik INDODAX · data baca-saja · bukan koneksi akun atau order.";
  }catch(e){
    target.innerHTML='<p class="muted">Ticker INDODAX tidak dapat dimuat dari browser saat ini. Coba refresh atau periksa koneksi/CORS.</p>';
    $("indodaxStatus").textContent="Data INDODAX tidak tersedia: "+String(e.message||e);
  }
}
function ema(a,p){if(a.length<p)return null;let k=2/(p+1),v=a.slice(0,p).reduce((s,x)=>s+x,0)/p;for(let i=p;i<a.length;i++)v=a[i]*k+v*(1-k);return v}
function rsi(a,p=14){if(a.length<=p)return null;let g=0,l=0;for(let i=a.length-p;i<a.length;i++){let d=a[i]-a[i-1];if(d>0)g+=d;else l-=d}if(l===0)return 100;return 100-100/(1+g/l)}
function atr(candles,p=14){
  if(candles.length<=p)return null;
  const tr=[];
  for(let i=1;i<candles.length;i++){
    const hi=Number(candles[i][2]),lo=Number(candles[i][3]),pc=Number(candles[i-1][4]);
    tr.push(Math.max(hi-lo,Math.abs(hi-pc),Math.abs(lo-pc)));
  }
  return tr.slice(-p).reduce((a,b)=>a+b,0)/p;
}
function macdHistogram(values){
  if(values.length<35)return null;
  const line=[];
  for(let i=0;i<values.length;i++){
    const fast=ema(values.slice(0,i+1),12),slow=ema(values.slice(0,i+1),26);
    if(Number.isFinite(fast)&&Number.isFinite(slow))line.push(fast-slow);
  }
  if(line.length<9)return null;
  const signal=ema(line,9);
  return line.at(-1)-signal;
}
function idr(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n)}
async function indodaxHistory(symbol,tf,lookbackSeconds){
  const now=Math.floor(Date.now()/1000),from=now-lookbackSeconds;
  const url="https://indodax.com/tradingview/history_v2?from="+from+"&symbol="+encodeURIComponent(symbol)+"&tf="+tf+"&to="+now;
  const data=await getJSON(url);
  const rows=Array.isArray(data)?data:(data.data||data.result||[]);
  if(!Array.isArray(rows)||rows.length<55)throw Error("Data candle tidak cukup ("+(rows?.length||0)+")");
  const seconds=tf==="1D"?86400:Number(tf)*60;
  return rows.map(x=>({time:Number(x.Time??x.time),open:Number(x.Open??x.open),high:Number(x.High??x.high),low:Number(x.Low??x.low),close:Number(x.Close??x.close),volume:Number(x.Volume??x.volume??0)}))
    .filter(x=>Number.isFinite(x.time)&&Number.isFinite(x.close)&&x.close>0&&x.time+seconds<=now)
    .sort((a,b)=>a.time-b.time);
}
async function analyzeIndodaxPair(symbol,label){
  const [h1,d1]=await Promise.all([
    indodaxHistory(symbol,"60",100*3600),
    indodaxHistory(symbol,"1D",120*86400)
  ]);
  if(h1.length<55||d1.length<55)throw Error("Riwayat candle tertutup belum cukup");
  const closes=h1.map(x=>x.close),daily=d1.map(x=>x.close);
  const last=h1.at(-1),price=last.close;
  const e9=ema(closes,9),e21=ema(closes,21),d20=ema(daily,20),d50=ema(daily,50);
  const r=rsi(closes,14),hist=macdHistogram(closes),volatility=atr(h1.map(x=>[x.time,x.open,x.high,x.low,x.close,x.volume]),14);
  const vols=h1.slice(-21,-1).map(x=>x.volume).filter(Number.isFinite);
  const avgVol=vols.length?vols.reduce((a,b)=>a+b,0)/vols.length:0;
  const volumeRatio=avgVol>0?last.volume/avgVol:0;
  if([e9,e21,d20,d50,r,hist,volatility].some(x=>!Number.isFinite(x))||volatility<=0)throw Error("Indikator belum dapat dihitung");
  const bull1=e9>e21,bullD=d20>d50,macdUp=hist>0,rsiOk=r>=50&&r<=68,volOk=volumeRatio>=0.8;
  const score=[bull1,bullD,macdUp,rsiOk,volOk].filter(Boolean).length*20;
  const bear1=e9<e21,bearD=d20<d50,macdDown=hist<0,rsiWeak=r<45;
  const bearScore=[bear1,bearD,macdDown,rsiWeak].filter(Boolean).length*25;
  let action="WAIT · NO CONFIRMATION",entry=null,tp=null,sl=null,kind="neutral",confidence=score;
  if(score>=80&&price>=e9){
    action="BUY SETUP";kind="up";entry=price;sl=entry-1.5*volatility;tp=entry+3*volatility;
  }else if(bearScore>=75){
    action="SELL / EXIT WARNING";kind="down";confidence=bearScore;
  }else if(bull1&&bullD&&price<e9){
    action="WAIT · PULLBACK";confidence=score;
  }
  return {symbol,label,price,r,e9,e21,d20,d50,hist,volumeRatio,action,kind,confidence,entry,tp,sl,closedAt:last.time};
}
async function loadSignals(){
  const root=$("signals");
  if(!root)return;
  root.innerHTML='<p class="muted">Mengambil candle publik INDODAX BTC/IDR dan ETH/IDR…</p>';
  const pairs=[["BTCIDR","Bitcoin · BTC/IDR"],["ETHIDR","Ethereum · ETH/IDR"]];
  const results=await Promise.all(pairs.map(async p=>{try{return await analyzeIndodaxPair(...p)}catch(e){return {symbol:p[0],label:p[1],error:String(e.message||e)}}}));
  root.innerHTML=results.map(x=>{
    if(x.error)return '<div class="signal-row"><div><b>'+x.label+'</b><small class="muted">Sinyal belum tersedia: '+x.error+'</small></div><strong class="neutral">WAIT</strong></div>';
    const plan=x.entry?'<small class="muted">Entry indikatif '+idr(x.entry)+'<br>TP '+idr(x.tp)+' · SL '+idr(x.sl)+'<br>Rasio target 1:2 · ATR 1H</small>':'<small class="muted">RSI '+fmt(x.r,1)+' · MACD '+(x.hist>0?"positif":"negatif")+' · Volume '+fmt(x.volumeRatio,2)+'× rata-rata 20 candle<br>EMA9/21 1H '+(x.e9>x.e21?"bullish":"bearish")+' · EMA20/50 harian '+(x.d20>x.d50?"bullish":"bearish")+'</small>';
    return '<div class="signal-row"><div><b>'+x.label+'</b><small class="muted">Harga candle tertutup '+idr(x.price)+' · Confidence '+x.confidence+'% · INDODAX OHLC</small>'+plan+'</div><strong class="'+x.kind+'">'+x.action+'</strong></div>';
  }).join("");
  $("engineStatus").textContent=results.some(x=>!x.error)?"INDODAX SIGNAL LIVE":"SIGNAL DATA UNAVAILABLE";
  for(const x of results){
    if(x.error)continue;
    if(alertEnabled&&x.action==="BUY SETUP"&&lastSignals[x.symbol]!=="BUY"&&Notification.permission==="granted"){
      new Notification("BEN AI · "+x.symbol,{body:"BUY setup indikatif. Entry "+idr(x.entry)+", TP "+idr(x.tp)+", SL "+idr(x.sl)+". Persetujuan transaksi tetap manual."});
    }
    lastSignals[x.symbol]=x.action==="BUY SETUP"?"BUY":x.action;
  }
}async function connectWallet(){if(!window.ethereum){$("walletInfo").textContent="Wallet provider tidak ditemukan. Buka melalui browser DApp MetaMask atau wallet kompatibel.";return}try{let a=await window.ethereum.request({method:"eth_requestAccounts"});if(!a.length)throw Error("Akun tidak dipilih");let p=new ethers.BrowserProvider(window.ethereum),n=await p.getNetwork(),b=await p.getBalance(a[0]);$("walletInfo").textContent="Alamat: "+a[0]+" · "+(chains[n.chainId.toString()]||"Chain "+n.chainId)+" · Native balance: "+Number(ethers.formatEther(b)).toFixed(6);if(chains[n.chainId.toString()])$("chainSelect").value=n.chainId.toString()}catch(e){$("walletInfo").textContent="Koneksi gagal/dibatalkan: "+e.message}}
async function switchChain(){if(!window.ethereum){$("walletInfo").textContent="Wallet provider tidak ditemukan.";return}let id=$("chainSelect").value;try{await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x"+Number(id).toString(16)}]});$("walletInfo").textContent="Network dipilih. Hubungkan ulang untuk memperbarui saldo."}catch(e){$("walletInfo").textContent=e.code===4902?"Network belum ditambahkan di wallet. Tambahkan melalui pengaturan wallet resmi.":e.message}}
function calculate(){let c=+$("capital").value,e=+$("entry").value,t=+$("target").value,s=+$("stop").value,r=+$("risk").value,o=$("calcResult");if(!(c>0&&e>0&&t>0&&s>0&&r>0&&r<=5)){o.textContent="Isi angka positif. Risk dibatasi maksimal 5%.";return}let long=t>e&&s<e,short=t<e&&s>e;if(!long&&!short){o.textContent="Untuk LONG: SL < entry < TP. Untuk SHORT: TP < entry < SL.";return}let riskUsd=c*r/100,qty=riskUsd/Math.abs(e-s),notional=qty*e,reward=qty*Math.abs(t-e),rr=Math.abs(t-e)/Math.abs(e-s);o.innerHTML="Arah: <b>"+(long?"LONG":"SHORT")+"</b><br>Ukuran posisi: <b>"+fmt(qty,8)+" unit</b><br>Nilai posisi: <b>"+usd(notional)+"</b><br>Risiko terencana: <b>"+usd(riskUsd)+"</b><br>Potensi target: <b>"+usd(reward)+"</b><br>Risk/reward: <b>1 : "+fmt(rr,2)+"</b><small> Tidak termasuk fee, spread, slippage, funding dan gap.</small>"}
function loadPortfolio(){let arr=[];try{arr=JSON.parse(localStorage.getItem("benai_positions")||"[]")}catch{}$("portfolio").innerHTML=arr.length?arr.map((p,i)=>'<div class="signal-row"><div><b>'+p.asset+'</b><small class="muted">Avg IDR '+fmt(p.avg)+' · Qty '+fmt(p.qty,8)+'</small></div><button class="ghost" data-del="'+i+'">Delete</button></div>').join(""):"Belum ada catatan posisi.";document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{arr.splice(+b.dataset.del,1);localStorage.setItem("benai_positions",JSON.stringify(arr));loadPortfolio()})}
function savePosition(){let asset=$("assetName").value.trim().toUpperCase(),avg=+$("avgPrice").value,qty=+$("units").value;if(!/^[A-Z0-9._-]{2,16}$/.test(asset)||!(avg>0&&qty>0)){$("portfolio").textContent="Isi ticker 2–16 karakter, average price dan quantity yang valid.";return}let a=JSON.parse(localStorage.getItem("benai_positions")||"[]");a.push({asset,avg,qty,created:new Date().toISOString()});localStorage.setItem("benai_positions",JSON.stringify(a));loadPortfolio()}
function initApp(){
  const bind=(id,event,fn)=>{const el=$(id);if(el)el.addEventListener(event,fn)};
  bind("refreshMarket","click",()=>{loadMarket();loadIndodax()});
  bind("connectWallet","click",connectWallet);
  bind("switchChain","click",switchChain);
  bind("calculate","click",calculate);
  bind("savePosition","click",savePosition);
  bind("enableAlerts","click",async()=>{
    if(!("Notification" in window)){const s=$("alertStatus");if(s)s.textContent="Browser tidak mendukung notifikasi.";return}
    let p=await Notification.requestPermission();alertEnabled=p==="granted";
    const s=$("alertStatus");if(s)s.textContent=alertEnabled?"Alert browser aktif selama halaman terbuka.":"Izin notifikasi tidak diberikan.";
  });
  loadPortfolio();
  loadMarket();
  loadIndodax();
  if(window.ethereum){
    window.ethereum.on?.("chainChanged",connectWallet);
    window.ethereum.on?.("accountsChanged",connectWallet);
  }
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initApp,{once:true});
else initApp();

/* INDODAX Worker gateway: credentials are session-only in this browser; exchange secrets stay in Cloudflare. */
let pendingIndodaxOrder=null;
const gateway=()=>({url:(sessionStorage.getItem("benai_worker_url")||"").replace(/\/$/, ""),token:sessionStorage.getItem("benai_dash_token")||""});
function gwHeaders(){const g=gateway();return {"Authorization":"Bearer "+g.token,"Accept":"application/json","Content-Type":"application/json"}}
async function gw(path,options={}){const g=gateway();if(!g.url||!g.token)throw Error("Isi Worker URL dan dashboard token terlebih dahulu.");const r=await fetch(g.url+path,{...options,headers:{...gwHeaders(),...(options.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok){const e=Error(data.error||("HTTP "+r.status));e.data=data;e.status=r.status;throw e}return data}
function orderPhrase(o){const size=o.type==="MARKET"&&o.side==="BUY"?"IDR "+o.quoteOrderQty:"qty "+o.quantity+(o.price?" @ "+o.price:"");return "SETUJUI "+o.side+" "+o.symbol+" "+o.type+" "+size}
function gatewayStatus(msg,ok=false){const e=$("gatewayStatus");if(e){e.textContent=msg;e.className="result "+(ok?"up":"")}}
async function checkGateway(){try{const g=gateway();if(!g.url)throw Error("Worker URL belum diisi.");const r=await fetch(g.url+"/health");const d=await r.json();if(!r.ok)throw Error("HTTP "+r.status);gatewayStatus("Worker terdeteksi · "+d.service+" · mode "+d.mode+" · live orders "+(d.liveOrders?"ON":"OFF")+" · approval wajib · withdrawals OFF",true)}catch(e){gatewayStatus("Koneksi gagal: "+e.message)}}
async function loadGatewayAccount(){try{const d=await gw("/account");$("accountInfo").textContent=JSON.stringify(d,null,2)}catch(e){$("accountInfo").textContent="Pemeriksaan akun gagal: "+e.message}}
async function loadGatewayOrders(){try{const d=await gw("/open-orders?symbol="+encodeURIComponent($("orderSymbol").value));$("accountInfo").textContent="Open orders: "+JSON.stringify(d,null,2)}catch(e){$("accountInfo").textContent="Open orders gagal: "+e.message}}
function readOrder(){const symbol=$("orderSymbol").value,side=$("orderSide").value,type=$("orderType").value,amount=Number($("orderAmount").value);if(!Number.isFinite(amount)||amount<=0)throw Error("Nominal/quantity harus lebih besar dari nol.");const o={symbol,side,type};if(type==="MARKET"&&side==="BUY"){if(!Number.isSafeInteger(amount)||amount>50000)throw Error("BUY market maksimal Rp50.000 untuk konfigurasi awal.");o.quoteOrderQty=String(amount)}else{o.quantity=String(amount);if(type==="LIMIT"){const price=Number($("orderPrice").value);if(!(price>0))throw Error("Harga limit wajib diisi.");o.price=String(price)}}return o}
function prepareGatewayOrder(){try{const o=readOrder();pendingIndodaxOrder=o;const phrase=orderPhrase(o);$("approvalSummary").textContent="Pair: "+o.symbol+"\nSide: "+o.side+"\nType: "+o.type+"\n"+(o.quoteOrderQty?"Nominal: Rp"+o.quoteOrderQty:"Quantity: "+o.quantity)+(o.price?"\nLimit price: Rp"+o.price:"")+"\n\nFrasa: "+phrase;$("approvalPhraseInput").value="";$("confirmOrder").disabled=true;$("approvalDialog").showModal()}catch(e){$("orderResult").textContent=e.message}}
async function submitApprovedOrder(){if(!pendingIndodaxOrder)return;const phrase=orderPhrase(pendingIndodaxOrder);if($("approvalPhraseInput").value!==phrase)return;try{$("confirmOrder").disabled=true;$("orderResult").textContent="Mengirim order yang telah disetujui…";const data=await gw("/order",{method:"POST",body:JSON.stringify({...pendingIndodaxOrder,approvalConfirmed:true,approvalPhrase:phrase})});$("orderResult").textContent="Respons Indodax: "+JSON.stringify(data,null,2);$("approvalDialog").close();pendingIndodaxOrder=null}catch(e){$("orderResult").textContent="Order ditolak/gagal: "+e.message+(e.data?.requiredPhrase?" · Frasa yang diminta: "+e.data.requiredPhrase:"");$("confirmOrder").disabled=false}}
function initGatewayUI(){const bind=(id,ev,fn)=>$(id)?.addEventListener(ev,fn);bind("saveGateway","click",()=>{const url=$("workerUrl").value.trim().replace(/\/$/,""),token=$("dashToken").value.trim();if(!/^https:\/\/.+\.workers\.dev$/.test(url)){gatewayStatus("Masukkan URL Cloudflare workers.dev yang valid.");return}if(!token){gatewayStatus("Dashboard token wajib diisi.");return}sessionStorage.setItem("benai_worker_url",url);sessionStorage.setItem("benai_dash_token",token);$("dashToken").value="";gatewayStatus("URL dan token tersimpan sementara sampai tab ditutup.",true);checkGateway()});bind("checkGateway","click",checkGateway);bind("loadAccount","click",loadGatewayAccount);bind("loadOrders","click",loadGatewayOrders);bind("prepareOrder","click",prepareGatewayOrder);bind("approvalPhraseInput","input",()=>{$("confirmOrder").disabled=$("approvalPhraseInput").value!==orderPhrase(pendingIndodaxOrder||{})});bind("confirmOrder","click",e=>{e.preventDefault();submitApprovedOrder()});const update=()=>{const side=$("orderSide").value,type=$("orderType").value;$("orderAmountLabel").textContent=type==="MARKET"&&side==="BUY"?"Nominal BUY (IDR)": "Quantity (coin)";$("orderPriceWrap").hidden=type!=="LIMIT"};bind("orderSide","change",update);bind("orderType","change",update);update();const g=gateway();if(g.url)$("workerUrl").value=g.url}
document.addEventListener("DOMContentLoaded",initGatewayUI,{once:true});
