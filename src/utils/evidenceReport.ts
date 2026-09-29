const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const signature=(r:any)=>JSON.stringify([r.id,r.requirement,r.importance||'Important',r.ruleType||'manual',r.acceptedTerms||[],r.minimumYears??null]);
export function evidenceReportRows(requirements:any[],evaluations:any[],reviews:any[]){
  return requirements.map(requirement=>{
    const saved=evaluations.find(e=>e.id===requirement.id);
    const current=!!saved?.requirementSnapshot&&signature(saved.requirementSnapshot)===signature(requirement);
    return {requirement,evaluation:current?saved:null,unverified:!!saved&&!current,review:reviews.find(r=>r.requirement_id===requirement.id)||null};
  });
}
export function renderEvidenceReport(ctx:any,approval:any,language:string,t:(key:string)=>string):string{
  let evaluations:any[]=[];
  try{const parsed=JSON.parse(ctx.candidate.checklist_eval||'[]');if(Array.isArray(parsed))evaluations=parsed;}catch{}
  const rows=evidenceReportRows(ctx.requirements,evaluations,ctx.reviews);
  const status=(value:string)=>t(['met','partial','not_met','unknown'].includes(value)?`requirement_${value}`:'requirement_unknown');
  const p=(label:string,value:unknown)=>`<p><strong>${escape(t(label))}:</strong> <bdi>${escape(value)}</bdi></p>`;
  const missing=t('reviewPending');
  return `<!doctype html><html lang="${language==='en'?'en':'ar'}" dir="${language==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(t('evidenceReportTitle'))}</title><style>
  body{font:16px/1.7 Arial,sans-serif;color:#18232f;margin:24px auto;padding:0 20px;max-width:1000px}h1{font-size:26px}h2{font-size:19px}article{border:1px solid #ccd3da;padding:16px;margin-block:20px;overflow-wrap:anywhere}p{white-space:pre-wrap;margin-block:8px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:20px}.notice{background:#f0f4f7;padding:12px}@media(max-width:650px){.columns{grid-template-columns:1fr}}@media print{@page{size:A4;margin:16mm}body{margin:0;padding:0;font-size:11pt}.no-print{display:none}article{break-inside:avoid}h2{break-after:avoid}.columns{display:block}}
  </style></head><body><h1>${escape(t('evidenceReportTitle'))}</h1><p class="no-print notice">${escape(t('evidenceReportPrintHelp'))}</p>
  ${p('identityName',ctx.candidate.name)}${p('jobTitle',ctx.job.title)}${p('projectName',ctx.job.project_name||t('notSpecified'))}
  ${p('evidenceReportGenerated',new Date().toISOString())}${p('evidenceReportRevision',ctx.revision)}
  <p class="notice">${escape(t('evidenceReportHelp'))}</p>
  ${p('assignmentType',approval?t(approval.assignment_type==='backup'?'assignmentBackup':'assignmentPrimary'):t('evidenceReportUnassigned'))}
  ${approval?p('evidenceReportReviewer',approval.reviewer)+'<p>'+escape(approval.approved_at)+'</p>':''}
  ${rows.length?rows.map(({requirement:r,evaluation:e,unverified,review:v},index)=>`<article><h2>${index+1}. <bdi>${escape(r.requirement)}</bdi></h2>
  ${p('importanceLevel',t(['Mandatory','Important','Additional'].includes(r.importance)?'importance_'+r.importance:'importance_Important'))}
  ${p('ruleTypeLabel',t(({manual:'ruleManual',term:'ruleTerm',certificate:'ruleCertificate',years:'ruleYears',degree:'ruleDegree'} as Record<string,string>)[r.ruleType]||'ruleManual'))}
  ${r.acceptedTerms?.length?p('ruleAcceptedTerms',r.acceptedTerms.join(' / ')):''}${r.minimumYears!=null?p('ruleMinimumYears',r.minimumYears):''}
  <div class="columns"><section><h3>${escape(t('evidenceReportAutomatic'))}</h3>
  ${p('colMatchStatus',e?status(e.status):t(unverified?'evidenceReportStale':'evidenceReportNoResult'))}
  ${e?p('colEvidence',e.evidence||t('notSpecified'))+p('reviewNote',e.justification||t('notSpecified')):''}</section>
  <section><h3>${escape(t('reviewTitle'))}</h3>${p('colMatchStatus',v?status(v.status):missing)}
  ${v?p('colEvidence',v.evidence||t('notSpecified'))+p('reviewNote',v.note)+p('reviewPage',v.page||t('notSpecified'))+p('evidenceReportReviewer',v.reviewer)+p('evidenceReportReviewedAt',v.reviewed_at):''}</section></div></article>`).join(''):`<p>${escape(t('evidenceReportEmpty'))}</p>`}
  </body></html>`;
}
