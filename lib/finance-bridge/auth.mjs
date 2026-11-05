// Shared wire contract: method + path + timestamp + raw body (no secrets in the URL).
// Cloudflare Workers and Node 22 both support WebCrypto.
const enc = new TextEncoder();
export async function bridgeSignature(secret,method,path,timestamp,body=''){
 if(typeof secret!=='string'||secret.length<32)throw new Error('Bridge secret is not provisioned');
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode([method.toUpperCase(),path,String(timestamp),body].join('\n'))));
 return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
export async function verifyBridgeRequest(request,body,secret,now=Date.now()){
 const ts=request.headers.get('x-foco-finance-timestamp')||'';
 const sig=request.headers.get('x-foco-finance-signature')||'';
 if(!/^\d{10}$/.test(ts)||!/^sha256=[a-f0-9]{64}$/.test(sig)||!Number.isFinite(now))return false;
 if(Math.abs(Math.floor(now/1000)-Number(ts))>300)return false;
 try{
  const url=new URL(request.url);
  const computed=await bridgeSignature(secret,request.method,url.pathname+url.search,ts,body);
  const actual=sig.slice(7);let diff=0;
  for(let i=0;i<64;i++)diff|=computed.charCodeAt(i)^actual.charCodeAt(i);
  return diff===0;
 }catch{return false;}
}
