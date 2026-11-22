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
  if(!r.ok) throw new Error("Indodax API HTTP "+r.status+": "+JSON.stringify(data).slice(0,300));
  return data;
}
export default {
 async fetch(req,env) {
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  const u=new URL(req.url);
  try {
   if(u.pathname==="/health") return json({ok:true,service:"BEN AI INDODAX",mode:env.BEN_LIVE_TRADING_ENABLED==="true"?"LIVE_ARMED":"SAFE_SETUP",liveOrders:env.BEN_LIVE_TRADING_ENABLED==="true",withdrawals:false});
   if(u.pathname==="/market" && req.method==="GET") {
    const r=await fetch("https://indodax.com/api/tickers",{headers:{Accept:"application/json"}});
    return json(await r.json(),r.status);
   }
   if(!authorized(req,env)) return json({error:"Unauthorized"},401);
   if(u.pathname==="/account" && req.method==="GET") return json(await privateRequest(env,"GET","/api/v2/account"));
   if(u.pathname==="/open-orders" && req.method==="GET") return json(await privateRequest(env,"GET","/api/v2/openOrders",{symbol:u.searchParams.get("symbol")||"btcidr"}));
   if(u.pathname==="/order" && req.method==="POST") {
    if(env.BEN_LIVE_TRADING_ENABLED!=="true") return json({error:"LIVE trading is locked. Set BEN_LIVE_TRADING_ENABLED=true only after paper testing and review."},423);
    const b=await req.json();
    const symbol=String(b.symbol||"").toLowerCase(), side=String(b.side||"").toUpperCase(), type=String(b.type||"LIMIT").toUpperCase();
    if(!["btcidr","ethidr"].includes(symbol) || !["BUY","SELL"].includes(side) || !["LIMIT","MARKET"].includes(type)) return json({error:"Invalid order parameters"},400);
    const quantity=Number(b.quantity), price=Number(b.price);
    if(!Number.isFinite(quantity)||quantity<=0 || (type==="LIMIT"&&(!Number.isFinite(price)||price<=0))) return json({error:"Invalid quantity/price"},400);
    if(quantity>Number(env.BEN_MAX_ORDER_QTY||0.0001)) return json({error:"Order exceeds BEN_MAX_ORDER_QTY safety cap"},400);
    const order={symbol,side,type,quantity:String(quantity)};
    if(type==="LIMIT") order.price=String(price);
    return json(await privateRequest(env,"POST","/api/v2/order",order));
   }
   return json({error:"Not found"},404);
  } catch(e){return json({error:String(e.message||e)},502);}
 }
};