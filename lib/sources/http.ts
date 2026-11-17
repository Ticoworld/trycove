export async function readBoundedBody(response:Response,maxBytes:number):Promise<Buffer>{
 if(!response.body)return Buffer.alloc(0);const reader=response.body.getReader();const chunks:Buffer[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;const chunk=Buffer.from(value);size+=chunk.length;if(size>maxBytes){await reader.cancel('response size limit exceeded');throw new Error(`Response exceeds ${maxBytes} byte limit`)}chunks.push(chunk)}}finally{reader.releaseLock()}
 return Buffer.concat(chunks,size);
}
