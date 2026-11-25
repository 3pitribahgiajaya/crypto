// BEN AI paper-only engine. This module never places exchange orders.
const finite = n => Number.isFinite(Number(n));
function ema(values, period) {
  if (values.length < period) return null;
  let value = values.slice(0, period).reduce((a,b)=>a+b,0)/period;
  const k = 2/(period+1);
  for (let i=period;i<values.length;i++) value=values[i]*k+value*(1-k);
  return value;
}
function rsi(values, period=14) {
  if (values.length <= period) return null;
  let gains=0, losses=0;
  for(let i=values.length-period;i<values.length;i++){
    const d=values[i]-values[i-1]; if(d>0) gains+=d; else losses-=d;
  }
  if(losses===0) return 100;
  return 100-100/(1+gains/losses);
}
function atr(candles, period=14) {
  if(candles.length<=period) return null;
  const trs=[];
  for(let i=1;i<candles.length;i++){
    const c=candles[i], prev=candles[i-1];
    trs.push(Math.max(c.high-c.low,Math.abs(c.high-prev.close),Math.abs(c.low-prev.close)));
  }
  return trs.slice(-period).reduce((a,b)=>a+b,0)/period;
}
export function evaluatePaperSignal({symbol,candles,capital=50000,position=null,feeRate=0.003,riskPct=1}) {
  if(!["BTCIDR","ETHIDR"].includes(symbol)) throw new Error("Pair tidak didukung");
  if(!Array.isArray(candles)||candles.length<55||candles.length>300) throw new Error("Butuh 55–300 candle");
  if(!finite(capital)||capital<=0||capital>50000) throw new Error("Modal simulasi maksimum Rp50.000");
  if(!finite(feeRate)||feeRate<0||feeRate>0.01) throw new Error("Fee simulasi harus 0–1%");
  if(!finite(riskPct)||riskPct<=0||riskPct>1) throw new Error("Risiko dibatasi maksimum 1% per posisi");
  const clean=candles.map(c=>({high:Number(c.high),low:Number(c.low),close:Number(c.close),time:Number(c.time)}));
  if(clean.some(c=>![c.high,c.low,c.close,c.time].every(Number.isFinite)||c.low<=0||c.high<c.low||c.close<=0)) throw new Error("Format candle tidak valid");
  const closes=clean.map(c=>c.close), last=clean.at(-1);
  const fast=ema(closes,9), slow=ema(closes,21), strength=rsi(closes,14), volatility=atr(clean,14);
  if(![fast,slow,strength,volatility].every(Number.isFinite)||volatility<=0) throw new Error("Indikator belum siap");
  const result={symbol,price:last.close,candleTime:last.time,ema9:fast,ema21:slow,rsi:strength,atr:volatility,decision:"WAIT",reason:"Belum ada konfirmasi entry",position:null,realizedPnl:0,feeRate};
  if(position){
    const stop=Number(position.stopLoss), target=Number(position.takeProfit), qty=Number(position.quantity), entry=Number(position.entry);
    if(![stop,target,qty,entry].every(Number.isFinite)||qty<=0||stop<=0||target<=entry||stop>=entry) throw new Error("Posisi paper tidak valid");
    let exit=null, why="";
    // Conservative bar handling: if both levels touched in one candle, assume SL first.
    if(last.low<=stop){exit=stop;why="STOP_LOSS";}
    else if(last.high>=target){exit=target;why="TAKE_PROFIT";}
    if(exit!==null){
      const gross=(exit-entry)*qty, fees=(entry+exit)*qty*feeRate;
      result.decision="CLOSE_LONG";result.reason=why;result.exitPrice=exit;result.realizedPnl=gross-fees;
    } else {result.decision="HOLD_LONG";result.reason="TP/SL belum tersentuh";result.position=position;}
    return result;
  }
  if(fast>slow && strength>=50 && strength<=68 && last.close>=fast){
    const entry=last.close, stop=entry-1.5*volatility, target=entry+3*volatility;
    const riskBudget=capital*riskPct/100, riskPerUnit=entry-stop;
    const quantity=Math.min((capital*0.5)/(entry*(1+feeRate)),riskBudget/riskPerUnit);
    if(quantity>0 && quantity*entry>=10000){
      result.decision="OPEN_LONG";
      result.reason="EMA9 di atas EMA21, RSI dalam rentang 50–68, harga di atas EMA9";
      result.position={symbol,side:"LONG",entry,stopLoss:stop,takeProfit:target,quantity,capitalAtEntry:capital,openedAt:last.time};
    } else result.reason="Sinyal valid tetapi ukuran posisi di bawah minimum simulasi Rp10.000";
  } else if(fast<slow && strength<45) {
    result.decision="EXIT_WARNING";result.reason="Momentum bearish; tidak membuka short";
  }
  return result;
}
