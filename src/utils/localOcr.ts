import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execute = promisify(execFile);
export const OCR_MAX_PAGES = 10;
export class LocalOcrError extends Error {
  constructor(public code: string) { super(code); }
}
type Runner = (file:string,args:string[])=>Promise<string>;
const run:Runner = async(file,args) => {
  const result = await execute(file,args,{ timeout:30_000,maxBuffer:4*1024*1024,env:{...process.env,OMP_THREAD_LIMIT:'1',LC_ALL:'C'} });
  return result.stdout;
};
let active = false;

/** Runs only local executables. No shell, network request or provider fallback. */
export async function extractLocalOcr(buffer:Buffer,mimeType:string, runner:Runner=run):Promise<string> {
  if (active) throw new LocalOcrError('ocr_busy');
  if (!['application/pdf','image/png','image/jpeg'].includes(mimeType)) throw new LocalOcrError('ocr_failed');
  if (buffer.length > 20*1024*1024) throw new LocalOcrError('ocr_limit');
  active=true;
  let dir:string|undefined;
  try {
    const languages = await runner('tesseract',['--list-langs']);
    if (!/^ara\s*$/m.test(languages) || !/^eng\s*$/m.test(languages)) throw new LocalOcrError('ocr_unavailable');
    dir=await mkdtemp(join(tmpdir(),'cv-local-ocr-'));
    const input=join(dir,mimeType==='application/pdf'?'input.pdf':'input.image');
    await writeFile(input,buffer);
    let pages=1;
    if(mimeType==='application/pdf') {
      const info=await runner('pdfinfo',[input]);
      pages=Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
      if(!Number.isInteger(pages)||pages<1||pages>OCR_MAX_PAGES) throw new LocalOcrError('ocr_limit');
    }
    const texts:string[]=[];
    for(let page=1;page<=pages;page++) {
      let imagePath=input;
      if(mimeType==='application/pdf') {
        const prefix=join(dir,'page');
        await runner('pdftoppm',['-f',String(page),'-l',String(page),'-singlefile','-scale-to','2400','-png',input,prefix]);
        imagePath=prefix+'.png';
      }
      texts.push(await runner('tesseract',[imagePath,'stdout','-l','ara+eng','--psm','3']));
    }
    const text=texts.join('\n\n').trim();
    if(text.replace(/\s/g,'').length<40) throw new LocalOcrError('ocr_no_text');
    return text;
  } catch(e:any) {
    if(e instanceof LocalOcrError) throw e;
    throw new LocalOcrError(e.code==='ENOENT'?'ocr_unavailable':e.killed?'ocr_timeout':'ocr_failed');
  } finally {
    try { if(dir) await rm(dir,{recursive:true,force:true}); } finally { active=false; }
  }
}
