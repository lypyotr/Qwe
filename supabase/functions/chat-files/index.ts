import { createClient } from "jsr:@supabase/supabase-js@2";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
const allowed=new Set(["image/jpeg","image/png","image/webp","image/gif","audio/webm","audio/ogg","audio/mpeg","application/pdf","text/plain","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 const auth=req.headers.get("Authorization")??"",url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const callerClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const{data:{user}}=await callerClient.auth.getUser();if(!user)return json({error:"unauthorized"},401);
 const admin=createClient(url,secret,{auth:{persistSession:false}});let body:any;try{body=await req.json()}catch{return json({error:"bad json"},400)}
 try{
  if(body.action==="upload"){
   const type=String(body.type||""),size=Number(body.size||0),recipient=String(body.recipient||""),room=String(body.room_id||"");
   if(!allowed.has(type)||size<1||size>15728640)return json({error:"file type or size not allowed"},400);
   let ok=false;if(room){const r=await admin.from("chat_members").select("room_id").eq("room_id",room).eq("user_id",user.id).maybeSingle();ok=!!r.data}
   else if(recipient){const r=await admin.from("friends").select("user_id").eq("user_id",user.id).eq("friend_id",recipient).eq("status","accepted").maybeSingle();ok=!!r.data}
   if(!ok)return json({error:"forbidden"},403);
   const safe=String(body.name||"file").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100),path=`${user.id}/${room||recipient}/${crypto.randomUUID()}-${safe}`;
   const{data,error}=await admin.storage.from("chat-files").createSignedUploadUrl(path);if(error)throw error;return json({path,token:data.token});
  }
  if(body.action==="download"){
   const{data:m,error}=await admin.from("messages").select("sender,recipient,room_id,metadata").eq("id",Number(body.message_id)).single();if(error)throw error;
   let ok=m.sender===user.id||m.recipient===user.id;if(!ok&&m.room_id){const r=await admin.from("chat_members").select("room_id").eq("room_id",m.room_id).eq("user_id",user.id).maybeSingle();ok=!!r.data}
   if(!ok)return json({error:"forbidden"},403);const path=m.metadata?.path;if(!path)return json({error:"no file"},404);
   const{data,error:e}=await admin.storage.from("chat-files").createSignedUrl(path,300);if(e)throw e;return json({url:data.signedUrl});
  }
  return json({error:"unknown action"},400);
 }catch(e){return json({error:e instanceof Error?e.message:"failed"},400)}
});
