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
  try{
    const rows=await Promise.all(coins.map(async([name,id,sym,pair])=>{const x=await binanceJSON("/api/v3/ticker/24hr?symbol="+pair);return [id,{usd:Number(x.lastPrice),usd_24h_change:Number(x.priceChangePercent)}]}));
    market=Object.fromEntries(rows);
    $("market").innerHTML=coins.map(([name,id,sym])=>{let x=market[id];return x?'<div class="market-row"><div><b>'+name+'</b><small class="muted">'+sym+'</small></div><div class="coin-price">'+usd(x.usd)+'<small class="'+(x.usd_24h_change>=0?"up":"down")+'">'+(x.usd_24h_change>=0?"+":"")+fmt(x.usd_24h_change,2)+'%</small></div></div>':""}).join("");
    $("marketStatus").textContent="Sumber Binance Spot · pasangan USDT sebagai pendekatan USD; harga indikatif, bukan harga eksekusi.";
    $("engineStatus").textContent="MARKET DATA ONLINE";
    await loadSignals();
  }catch(e){
    $("market").textContent="Data pasar gagal dimuat. Coba refresh atau periksa koneksi.";
    $("marketStatus").textContent="Market API tidak dapat dijangkau: "+e.message;
    $("engineStatus").textContent="DATA UNAVAILABLE";
    $("signals").textContent="Sinyal ditahan karena data pasar belum tersedia.";
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
async function loadSignals(){
  let htmlOut="";
  for(const [name,id,sym,pair] of coins){
    try{
      const [hourly,daily]=await Promise.all([
        binanceJSON("/api/v3/klines?symbol="+pair+"&interval=1h&limit=100"),
        binanceJSON("/api/v3/klines?symbol="+pair+"&interval=1d&limit=60")
      ]);
      const closes=hourly.map(x=>Number(x[4])).filter(Number.isFinite);
      const dailyCloses=daily.map(x=>Number(x[4])).filter(Number.isFinite);
      const e20=ema(closes,20),e50=ema(closes,50),r= rsi(closes,14);
      const d20=ema(dailyCloses,20),d50=ema(dailyCloses,50);
      const volatility=atr(hourly,14),price=market[id]?.usd||closes.at(-1);
      if([e20,e50,r,d20,d50,volatility,price].some(x=>!Number.isFinite(x)||x<=0))throw Error("Insufficient candle data");
      const trendUp=e20>e50&&d20>d50;
      const extension=(price-e20)/volatility;
      const buyNow=trendUp&&r>=50&&r<=65&&price>=e20&&extension<=1.2;
      const pullback=trendUp&&price>e20&&extension>1.2;
      let entry=buyNow?price:(trendUp?e20:null);
      let sl=entry?entry-1.5*volatility:null;
      let tp=entry?entry+3*volatility:null;
      const action=buyNow?"BUY SETUP":(pullback?"WAIT · PULLBACK": "WAIT · NO CONFIRMATION");
      const cls=buyNow?"up":"neutral";
      const plan=entry
        ?'<small class="muted">Entry '+(buyNow?"area now":"limit/watch near EMA20")+' · '+usd(entry)+'<br>TP '+usd(tp)+' · SL '+usd(sl)+'<br>Risk/reward target 1:2 · ATR(14) 1H</small>'
        :'<small class="muted">Belum ada entry valid. Tunggu EMA20 1H > EMA50 1H dan EMA20 harian > EMA50 harian; RSI 1H 50–65.</small>';
      htmlOut+='<div class="signal-row"><div><b>'+name+' · '+sym+'</b><small class="muted">Harga '+usd(price)+' · RSI '+fmt(r,1)+' · EMA20/50 1H '+(e20>e50?"bullish":"bearish")+' · Daily '+(d20>d50?"bullish":"bearish")+'</small>'+plan+'</div><strong class="'+cls+'">'+action+'</strong></div>';
      const sig=buyNow?"BUY":action;
      if(alertEnabled&&buyNow&&lastSignals[id]!=="BUY"&&Notification.permission==="granted")new Notification("BEN AI · "+sym,{body:"BUY setup indikatif. Entry "+usd(entry)+", TP "+usd(tp)+", SL "+usd(sl)+". Periksa spread dan konfirmasi manual."});
      lastSignals[id]=sig;
    }catch(e){
      htmlOut+='<div class="signal-row"><div><b>'+name+' · '+sym+'</b><small class="muted">Sinyal tidak tersedia: '+String(e.message||e)+'</small></div><strong class="neutral">WAIT</strong></div>';
    }
  }
  $("signals").innerHTML=htmlOut||"Belum ada sinyal.";
}
async function connectWallet(){if(!window.ethereum){$("walletInfo").textContent="Wallet provider tidak ditemukan. Buka melalui browser DApp MetaMask atau wallet kompatibel.";return}try{let a=await window.ethereum.request({method:"eth_requestAccounts"});if(!a.length)throw Error("Akun tidak dipilih");let p=new ethers.BrowserProvider(window.ethereum),n=await p.getNetwork(),b=await p.getBalance(a[0]);$("walletInfo").textContent="Alamat: "+a[0]+" · "+(chains[n.chainId.toString()]||"Chain "+n.chainId)+" · Native balance: "+Number(ethers.formatEther(b)).toFixed(6);if(chains[n.chainId.toString()])$("chainSelect").value=n.chainId.toString()}catch(e){$("walletInfo").textContent="Koneksi gagal/dibatalkan: "+e.message}}
async function switchChain(){if(!window.ethereum){$("walletInfo").textContent="Wallet provider tidak ditemukan.";return}let id=$("chainSelect").value;try{await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x"+Number(id).toString(16)}]});$("walletInfo").textContent="Network dipilih. Hubungkan ulang untuk memperbarui saldo."}catch(e){$("walletInfo").textContent=e.code===4902?"Network belum ditambahkan di wallet. Tambahkan melalui pengaturan wallet resmi.":e.message}}
function calculate(){let c=+$("capital").value,e=+$("entry").value,t=+$("target").value,s=+$("stop").value,r=+$("risk").value,o=$("calcResult");if(!(c>0&&e>0&&t>0&&s>0&&r>0&&r<=5)){o.textContent="Isi angka positif. Risk dibatasi maksimal 5%.";return}let long=t>e&&s<e,short=t<e&&s>e;if(!long&&!short){o.textContent="Untuk LONG: SL < entry < TP. Untuk SHORT: TP < entry < SL.";return}let riskUsd=c*r/100,qty=riskUsd/Math.abs(e-s),notional=qty*e,reward=qty*Math.abs(t-e),rr=Math.abs(t-e)/Math.abs(e-s);o.innerHTML="Arah: <b>"+(long?"LONG":"SHORT")+"</b><br>Ukuran posisi: <b>"+fmt(qty,8)+" unit</b><br>Nilai posisi: <b>"+usd(notional)+"</b><br>Risiko terencana: <b>"+usd(riskUsd)+"</b><br>Potensi target: <b>"+usd(reward)+"</b><br>Risk/reward: <b>1 : "+fmt(rr,2)+"</b><small> Tidak termasuk fee, spread, slippage, funding dan gap.</small>"}
function loadPortfolio(){let arr=[];try{arr=JSON.parse(localStorage.getItem("benai_positions")||"[]")}catch{}$("portfolio").innerHTML=arr.length?arr.map((p,i)=>'<div class="signal-row"><div><b>'+p.asset+'</b><small class="muted">Avg IDR '+fmt(p.avg)+' · Qty '+fmt(p.qty,8)+'</small></div><button class="ghost" data-del="'+i+'">Delete</button></div>').join(""):"Belum ada catatan posisi.";document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{arr.splice(+b.dataset.del,1);localStorage.setItem("benai_positions",JSON.stringify(arr));loadPortfolio()})}
function savePosition(){let asset=$("assetName").value.trim().toUpperCase(),avg=+$("avgPrice").value,qty=+$("units").value;if(!/^[A-Z0-9._-]{2,16}$/.test(asset)||!(avg>0&&qty>0)){$("portfolio").textContent="Isi ticker 2–16 karakter, average price dan quantity yang valid.";return}let a=JSON.parse(localStorage.getItem("benai_positions")||"[]");a.push({asset,avg,qty,created:new Date().toISOString()});localStorage.setItem("benai_positions",JSON.stringify(a));loadPortfolio()}
function initApp(){
  const bind=(id,event,fn)=>{const el=$(id);if(el)el.addEventListener(event,fn)};
  bind("refreshMarket","click",loadMarket);
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
  if(window.ethereum){
    window.ethereum.on?.("chainChanged",connectWallet);
    window.ethereum.on?.("accountsChanged",connectWallet);
  }
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initApp,{once:true});
else initApp();
