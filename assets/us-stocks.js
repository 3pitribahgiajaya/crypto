"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const symbols = ["AAPL","NVDA","TSLA","MSFT","AMZN"];
  const fmt = (n,d=2) => new Intl.NumberFormat("en-US",{maximumFractionDigits:d}).format(n);
  const money = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
  const ema = (a,p) => {
    if(a.length<p) return null;
    const k=2/(p+1); let v=a.slice(0,p).reduce((s,x)=>s+x,0)/p;
    for(let i=p;i<a.length;i++) v=a[i]*k+v*(1-k);
    return v;
  };
  const rsi = (a,p=14) => {
    if(a.length<=p) return null;
    let g=0,l=0;
    for(let i=a.length-p;i<a.length;i++){const d=a[i]-a[i-1]; if(d>0)g+=d;else l-=d;}
    return l===0?100:100-100/(1+g/l);
  };
  const atr = (rows,p=14) => {
    if(rows.length<=p)return null;
    const tr=[];
    for(let i=1;i<rows.length;i++) tr.push(Math.max(rows[i].high-rows[i].low,Math.abs(rows[i].high-rows[i-1].close),Math.abs(rows[i].low-rows[i-1].close)));
    return tr.slice(-p).reduce((a,b)=>a+b,0)/p;
  };
  const macd = a => {
    const line=[];
    for(let i=0;i<a.length;i++){const f=ema(a.slice(0,i+1),12),s=ema(a.slice(0,i+1),26);if(Number.isFinite(f)&&Number.isFinite(s))line.push(f-s);}
    if(line.length<9)return null;
    return line.at(-1)-ema(line,9);
  };
  async function fetchChart(symbol,range,interval){
    const url="https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(symbol)+"?range="+range+"&interval="+interval+"&events=history";
    const res=await fetch(url,{headers:{accept:"application/json"}});
    if(!res.ok)throw Error("Data provider HTTP "+res.status);
    const json=await res.json(), result=json.chart&&json.chart.result&&json.chart.result[0];
    if(!result)throw Error(json.chart?.error?.description||"Data candle tidak tersedia");
    const q=result.indicators.quote[0], rows=[];
    for(let i=0;i<result.timestamp.length;i++){
      const close=q.close[i],high=q.high[i],low=q.low[i],volume=q.volume[i];
      if(Number.isFinite(close)&&Number.isFinite(high)&&Number.isFinite(low))rows.push({time:result.timestamp[i],close,high,low,volume:Number(volume||0)});
    }
    if(rows.length<55)throw Error("Riwayat candle tidak cukup");
    return {rows,currency:result.meta.currency||"USD",exchange:result.meta.exchangeName||"Market"};
  }
  function analyze(symbol,rows){
    const c=rows.map(x=>x.close), last=rows.at(-1), e20=ema(c,20),e50=ema(c,50),r=rsi(c),m=macd(c),a=atr(rows);
    const vols=rows.slice(-21,-1).map(x=>x.volume),avg=vols.reduce((s,x)=>s+x,0)/(vols.length||1),vr=avg>0?last.volume/avg:0;
    const checks=[e20>e50,last.close>e20,m>0,r>=50&&r<=68,vr>=0.8], score=checks.filter(Boolean).length*20;
    const bear=[e20<e50,last.close<e20,m<0,r<45].filter(Boolean).length*25;
    let signal="WAIT",entry=null,tp=null,sl=null;
    if(score>=80){signal="BUY SETUP";entry=last.close;sl=entry-1.5*a;tp=entry+3*a;}
    else if(bear>=75)signal="SELL / EXIT WARNING";
    return {symbol,price:last.close,signal,score:signal.startsWith("SELL")?bear:score,rsi:r,ema20:e20,ema50:e50,macd:m,volumeRatio:vr,entry,tp,sl,stamp:last.time,currency: "USD"};
  }
  function render(items){
    const root=$("usSignals"); if(!root)return;
    root.innerHTML=items.map(x=>{
      if(x.error)return '<div class="signal-row"><div><b>'+x.symbol+'</b><small class="muted">'+x.error+'</small></div><strong class="neutral">N/A</strong></div>';
      const cls=x.signal==="BUY SETUP"?"up":x.signal.startsWith("SELL")?"down":"neutral";
      const plan=x.entry?'<small class="muted">Entry '+money(x.entry)+' · TP '+money(x.tp)+' · SL '+money(x.sl)+'<br>RSI '+fmt(x.rsi,1)+' · Volume '+fmt(x.volumeRatio,2)+'× · Risk/reward 1:2</small>':'<small class="muted">RSI '+fmt(x.rsi,1)+' · EMA20/50 '+(x.ema20>x.ema50?"bullish":"bearish")+' · MACD '+(x.macd>0?"positive":"negative")+' · Volume '+fmt(x.volumeRatio,2)+'×</small>';
      return '<div class="signal-row"><div><b>'+x.symbol+' · '+money(x.price)+'</b><small class="muted">Score '+x.score+'/100 · candle terakhir '+new Date(x.stamp*1000).toLocaleString()</small>'+plan+'</div><strong class="'+cls+'">'+x.signal+'</strong></div>';
    }).join("");
  }
  async function scan(){
    const root=$("usSignals"); if(!root)return;
    root.innerHTML='<p class="muted">Memuat candle harian US stocks…</p>';
    const requested=($("usSymbols")?.value||"").split(",").map(x=>x.trim().toUpperCase()).filter(Boolean);
    const list=[...new Set([...symbols,...requested])].slice(0,15);
    const results=await Promise.all(list.map(async symbol=>{
      if(!/^[A-Z.\-]{1,10}$/.test(symbol))return {symbol,error:"Ticker tidak valid"};
      try{const data=await fetchChart(symbol,"6mo","1d");return analyze(symbol,data.rows);}
      catch(e){return {symbol,error:String(e.message||e)+" (provider/browser mungkin membatasi akses)"};}
    }));
    render(results);
    const ok=results.filter(x=>!x.error).length;
    const status=$("usSignalStatus");
    if(status)status.textContent="Yahoo Finance chart · "+ok+"/"+results.length+" ticker terbaca · candle harian; data dapat tertunda dan bergantung ketersediaan provider.";
  }
  document.addEventListener("DOMContentLoaded",()=>{
    $("scanUS")?.addEventListener("click",scan);
    scan();
  });
})();
