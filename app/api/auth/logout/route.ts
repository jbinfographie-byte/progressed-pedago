import { clearSessionHeader, deleteSession } from "@/app/auth";

export async function POST(request:Request){
  try{await deleteSession(request)}catch{}
  return Response.json({ok:true},{headers:{"set-cookie":clearSessionHeader()}});
}
