const cors = {
  "Access-Control-Allow-Origin": "https://3pitribahgiajaya.github.io",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Cache-Control": "no-store"
};
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{...cors,"Content-Type":"application/json"}});
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sign(secret, body) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
}
function authorized(req, env) {
  const h=req.headers.get("Authorization")||"";
  return !!env.BEN_DASH_TOKEN && h === "Bearer "+env.BEN_DASH_TOKEN;
}
function expectedApproval(order) {
  // Exact transaction summary must be explicitly confirmed by the user in the UI.
  const size = order.type==="MARKET" && order.side==="BUY"
    ? `IDR ${order.quoteOrderQty}`
    : `qty ${order.quantity}${order.price ? ` @ ${order.price}` : ""}`;
  return `SETUJUI ${order.side} ${order.symbol} ${order.type} ${size}`;
}
async function privateRequest(env, method, path, params={}) {
  if(!env.INDODAX_API_KEY || !env.INDODAX_API_SECRET) throw new Error("Indodax API secrets belum dipasang di Cloudflare.");
  const p={...params,timestamp:Date.now(),recvWindow:5000};
  const body=new URLSearchParams(p).toString();
  const signature=await sign(env.INDODAX_API_SECRET,body);
  const headers={"Accept":"application/json","X-APIKEY":env.INDODAX_API_KEY,"Sign":signature};
  let url="https://api.indodax.com"+path, init={method,headers};
  if(method==="POST"){headers["Content-Type"]="application/x-www-form-urlencoded";init.body=body;}
  else url+="?"+body;
  const r=await fetch(url,init), data=await r.json().catch(()=>({}));
  if(!r.ok || (data && typeof data==="object" && Number(data.code)<0)) {
    throw new Error("Indodax API error "+r.status+": "+JSON.stringify(data).slice(0,300));
  }
  return data;
}
export default {
 async fetch(req,env) {
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  const u=new URL(req.url);
  try {
   if(u.pathname==="/health" && req.method==="GET") return json({ok:true,service:"BEN AI INDODAX",mode:env.BEN_LIVE_TRADING_ENABLED==="true"?"LIVE_ARMED":"SAFE_SETUP",liveOrders:env.BEN_LIVE_TRADING_ENABLED==="true",approvalRequired:true,withdrawals:false});
   if(u.pathname==="/market" && req.method==="GET") {
    // Use the documented INDODAX Trade API v2 public ticker endpoint.
    // Restrict to the two supported trading pairs used by BEN AI.
    const marketUrl = "https://api.indodax.com/api/v2/ticker/24hr?symbols=BTCIDR,ETHIDR";
    const r = await fetch(marketUrl, {headers:{Accept:"application/json"}});
    const raw = await r.text();
    let rows;
    try { rows = JSON.parse(raw); }
    catch { throw new Error("Indodax market returned non-JSON response (HTTP "+r.status+")."); }
    if (!r.ok) return json({error:"Indodax market API error",status:r.status,details:rows},502);
    const list = Array.isArray(rows) ? rows : (rows && rows.symbol ? [rows] : []);
    const tickers = {};
    for (const t of list) {
      const key = String(t.symbol||"").toLowerCase().replace("idr","_idr");
      if (!key) continue;
      tickers[key] = {
        last: t.lastPrice, buy: t.bidPrice, sell: t.askPrice,
        high: t.highPrice, low: t.lowPrice,
        vol_idr: t.quoteVolume, volume: t.volume,
        priceChangePercent: t.priceChangePercent,
        server_time: Math.floor(Date.now()/1000)
      };
    }
    return json({tickers,source:"INDODAX_TAPI_V2",updatedAt:new Date().toISOString()});
   }
   if(!authorized(req,env)) return json({error:"Unauthorized"},401);
   if(u.pathname==="/account" && req.method==="GET") return json(await privateRequest(env,"GET","/api/v2/account"));
   if(u.pathname==="/open-orders" && req.method==="GET") {
    const symbol=u.searchParams.get("symbol");
    const params=symbol?{symbol:symbol.toUpperCase()}:{};
    return json(await privateRequest(env,"GET","/api/v2/openOrders",params));
   }
   if(u.pathname==="/order" && req.method==="POST") {
    if(env.BEN_LIVE_TRADING_ENABLED!=="true") return json({error:"LIVE trading is locked. Keep disabled until tests and deployment review are complete."},423);
    const b=await req.json();
    const symbol=String(b.symbol||"").toUpperCase(), side=String(b.side||"").toUpperCase(), type=String(b.type||"LIMIT").toUpperCase();
    if(!["BTCIDR","ETHIDR"].includes(symbol) || !["BUY","SELL"].includes(side) || !["LIMIT","MARKET"].includes(type)) return json({error:"Invalid order parameters"},400);
    const order={symbol,side,type};
    if(type==="LIMIT") {
      const quantity=Number(b.quantity), price=Number(b.price);
      if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(price)||price<=0) return json({error:"Invalid limit quantity/price"},400);
      if(quantity>Number(env.BEN_MAX_ORDER_QTY||0.0001)) return json({error:"Order exceeds BEN_MAX_ORDER_QTY safety cap"},400);
      order.quantity=String(quantity); order.price=String(price);
    } else if(side==="BUY") {
      const quoteOrderQty=Number(b.quoteOrderQty);
      if(!Number.isSafeInteger(quoteOrderQty)||quoteOrderQty<=0||quoteOrderQty>Number(env.BEN_MAX_MARKET_BUY_IDR||50000)) return json({error:"Market BUY must use integer quoteOrderQty within BEN_MAX_MARKET_BUY_IDR"},400);
      order.quoteOrderQty=String(quoteOrderQty);
    } else {
      const quantity=Number(b.quantity);
      if(!Number.isFinite(quantity)||quantity<=0||quantity>Number(env.BEN_MAX_ORDER_QTY||0.0001)) return json({error:"Invalid or excessive market SELL quantity"},400);
      order.quantity=String(quantity);
    }
    const requiredPhrase=expectedApproval(order);
    if(b.approvalConfirmed!==true || b.approvalPhrase!==requiredPhrase) {
      return json({error:"Human approval required. No order was sent to Indodax.",approvalRequired:true,requiredPhrase},428);
    }
    return json(await privateRequest(env,"POST","/api/v2/order",order));
   }
   return json({error:"Not found"},404);
  } catch(e){return json({error:String(e.message||e)},502);}
 }
};
