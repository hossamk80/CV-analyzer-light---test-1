import type { Express } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import { extname } from 'node:path';
import { parseJobRequirements, tableToText } from './utils/jobImport.js';
import { extractLocalOcr, LocalOcrError } from './utils/localOcr.js';

export function registerJobImportApi(app:Express,auth:any,permission:any,translate:any){
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:20*1024*1024,files:1,fields:2,fieldSize:400000}}).single('file');
  app.post('/api/job-import',auth,permission,(req,res)=>{
    const fail=(code:string,status=400)=>res.status(status).json({error:translate(req.headers['accept-language'])(code),errorCode:code});
    upload(req,res,async(error:any)=>{
      if(error)return fail('jobImportInvalid');
      try{
        let text=req.body?.text;let ocr=false;
        if(req.file){
          const {buffer,originalname}=req.file;const ext=extname(originalname).toLowerCase();
          if(['.txt','.csv','.tsv'].includes(ext)){
            text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
            if(ext==='.csv')text=tableToText(text,',');
          }
          else if(ext==='.docx'&&buffer.subarray(0,2).toString()==='PK')text=(await mammoth.extractRawText({buffer})).value;
          else if(ext==='.pdf'&&buffer.subarray(0,5).toString()==='%PDF-'){
            try{const mod:any=await import('pdf-parse');text=(await (mod.default||mod)(buffer)).text;}catch{text='';}
            if(!text||text.replace(/\s/g,'').length<40){text=await extractLocalOcr(buffer,'application/pdf');ocr=true;}
          }else if((ext==='.png'&&buffer.subarray(0,8).toString('hex')==='89504e470d0a1a0a')||(['.jpg','.jpeg'].includes(ext)&&buffer.subarray(0,3).toString('hex')==='ffd8ff')){
            text=await extractLocalOcr(buffer,ext==='.png'?'image/png':'image/jpeg');ocr=true;
          }else return fail('jobImportFormat');
        }
        if(typeof text!=='string'||!text.trim()||text.length>100000)return fail('jobImportInvalid');
        res.json({...parseJobRequirements(text),ocr});
      }catch(e){return fail(e instanceof LocalOcrError?e.code:'jobImportInvalid');}
    });
  });
}
