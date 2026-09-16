import type { ScreeningRequirement } from './requirementRules.js';
import {suggestImportRule,type ImportSuggestion} from './importSuggestions.js';

const labels: Record<string,string[]> = {
  title:['job title','position','المسمى الوظيفي','المسمى','الوظيفة'],
  degree:['education','degree','qualification','المؤهل العلمي','المؤهل','التعليم'],
  requiredCerts:['certifications','certificates','الشهادات','الشهادات المهنية'],
  experience:['experience','experience years','exp. years','الخبرة','سنوات الخبرة'],
  technicalSkills:['technical skills','skills','المهارات التقنية','المهارات الفنية','المهارات'],
  department:['department','القسم','الإدارة'], location:['location','مكان العمل','الموقع'],
  nationality:['nationality','الجنسية'],languages:['languages','اللغات'],
  coreResponsibilities:['responsibilities','المسؤوليات','المهام'],
  additionalRequirements:['additional requirements','متطلبات إضافية'],
};
export interface JobImportDraft {
  fields:Record<string,string|number>;
  checklist:ScreeningRequirement[];
  sourceText:string;
  unclassified:string[];
  suggestions:ImportSuggestion[];
}
const clean=(s:string)=>s.trim().replace(/^[|•*\-]\s*/u,'').replace(/^[\d٠-٩]+[.)]\s*/u,'').replace(/[\s:：|]+$/u,'').trim();
const keyFor=(s:string)=>Object.entries(labels).find(([,names])=>names.includes(clean(s).toLowerCase()))?.[0];
/** RFC-style quoted cells, including embedded newlines. One record with headers or label/value rows. */
export function tableToText(text:string,delimiter:string):string {
  const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&(ch===delimiter||ch==='\n')){row.push(cell);cell='';if(ch==='\n'){rows.push(row);row=[];}}
    else if(ch!=='\r')cell+=ch;
  }
  if(quoted)throw new Error('jobImportInvalid');
  row.push(cell);if(row.some(s=>s.trim()))rows.push(row);
  const nonempty=rows.filter(r=>r.some(s=>s.trim()));
  const header=nonempty[0]||[];
  if(header.length>1&&header.every(c=>keyFor(c))){
    if(nonempty.length!==2)throw new Error('jobImportInvalid');
    return header.map((label,i)=>label+': '+(nonempty[1][i]||'').replace(/\n/g,'; ')).join('\n');
  }
  return nonempty.map(r=>r.map(c=>c.replace(/\n/g,'; ')).join('\t')).join('\n');
}
/** Conservative heading/label parser. Original wording is retained; rules remain manual until reviewed. */
export function parseJobRequirements(text:string):JobImportDraft {
  if(!text.trim()||text.length>100000)throw new Error('jobImportInvalid');
  const sourceText=text;
  if(text.includes('\t'))text=tableToText(text,'\t');
  const buckets:Record<string,string[]>={};const unclassified:string[]=[];
  let section:string|undefined;
  for(const raw of text.replace(/\r/g,'').split('\n')) {
    const line=clean(raw);if(!line||/^[-|:\s]+$/.test(line))continue;
    if(/^(job requirements?|متطلبات الوظيفة)$/i.test(line)) {section=undefined;continue;}
    const cells=line.split(/\t|\|/).map(s=>s.trim()).filter(Boolean);
    const pair=line.match(/^([^:：]{1,60})[:：]\s*(.+)$/);
    const label=keyFor(cells[0])|| (pair?keyFor(pair[1]):undefined);
    if(label){section=label;const value=cells.length>1?cells.slice(1).join('; '):pair?.[2];if(value)(buckets[label]??=[]).push(value);continue;}
    const heading=keyFor(line);if(heading){section=heading;continue;}
    if(section){(buckets[section]??=[]).push(line);}
    else if(!buckets.title&&line.length<180){buckets.title=[line];}
    else unclassified.push(line);
  }
  const fields:Record<string,string|number>={jobDescription:sourceText};const checklist:ScreeningRequirement[]=[];const suggestions:ImportSuggestion[]=[];
  for(const [key,lines] of Object.entries(buckets)){
    const meaningful=lines.filter(s=>! /^(candidates must hold the following certifications|proficiency in managing, operating, and working with)[:：]?$/i.test(s));
    if(key==='experience'){
      const value=meaningful.join(' ').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
      const n=value.match(/(?:\b|\()(\d{1,2})(?:\)|\b)\s*(?:years?|سنوات|سنة|عام)/i)||value.match(/^\s*(\d{1,2})\s*$/);
      if(n&&Number(n[1])<=60)fields.experience=Number(n[1]);else unclassified.push(...meaningful);
    }else if(meaningful.length) fields[key]=meaningful.join(key==='technicalSkills'?', ':'; ');
    if(['degree','requiredCerts','experience','technicalSkills'].includes(key))for(const requirement of meaningful){
      if(requirement.length<=4000&&checklist.length<200){
        const id=`import-${checklist.length+1}`;
        checklist.push({id,requirement,importance:'Important',ruleType:'manual'});
        const category=({degree:'degree',requiredCerts:'certificate',experience:'years',technicalSkills:'term'} as const)[key]!;
        const mandatory=/\bmust\b|إلزامي|يجب|يشترط/i.test(requirement)||(key==='requiredCerts'&&lines.some(s=>/^candidates must hold the following certifications[:：]?$/i.test(s)));
        suggestions.push(suggestImportRule(requirement,category,id,mandatory));
      }
    }
  }
  // Degree specialization is extracted only from an explicit separator, never inferred from a title.
  if(typeof fields.degree==='string'){
    const match=fields.degree.match(/^(.*?(?:degree|بكالوريوس|ماجستير|دكتوراه))\s+(?:in|في)\s+(.+?)[.]?$/i);
    if(match){fields.degree=match[1];fields.specialization=match[2];}
  }
  return {fields,checklist,sourceText,unclassified,suggestions};
}
