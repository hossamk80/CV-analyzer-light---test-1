export interface CoverageRow {
  jobId:number; projectName:string; title:string; required:number; reviewed:number;
  approved:number; backups:number; shortage:number;
  primaryNames:string[]; backupNames:string[];
}
export function summarizeProjects(rows:CoverageRow[]) {
  const groups=new Map<string,{key:string;name:string;required:number;approved:number;backups:number;shortage:number;readiness:number}>();
  for(const row of rows) {
    const key=row.projectName.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase() || `unnamed-job:${row.jobId}`;
    const group=groups.get(key)||{key,name:row.projectName,required:0,approved:0,backups:0,shortage:0,readiness:0};
    group.required+=row.required;group.approved+=Math.min(row.required,row.approved);group.backups+=row.backups;
    group.shortage+=Math.max(0,row.required-row.approved);
    group.readiness=group.required?Math.floor(group.approved/group.required*100):0;
    groups.set(key,group);
  }
  return [...groups.values()];
}
/** Escape delimiters and neutralize spreadsheet formula prefixes from user-controlled cells. */
export function csvDocument(rows:unknown[][]):string {
  return '\uFEFF'+rows.map(row=>row.map(value=>{
    let text=String(value??'');
    if(/^[\s\uFEFF]*[=+@-]/u.test(text)||/^[\t\r\n]/.test(text)) text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }).join(',')).join('\r\n');
}
