export type MissingDependencyFailure={rejected:true;measurementsTrusted:false;error:string};

/** Accept only the expected debugger failure; a returned profile is a harness failure. */
export async function captureMissingDependencyFailure(runReplay:()=>Promise<unknown>):Promise<MissingDependencyFailure>{
 try{
  await runReplay();
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  if(!/exit\s+1[\s\S]*used unprovided cell dep/i.test(message)){
   throw new Error(`Missing-CellDeps replay failed for an unexpected reason: ${message}`,{cause:error});
  }
  return{rejected:true,measurementsTrusted:false,error:message};
 }
 throw new Error('Missing-CellDeps replay unexpectedly returned a profile; refusing to record it as rejected.');
}
