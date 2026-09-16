import type { ScreeningRequirement } from './requirementRules.js';

export interface ImportSuggestion {
  category:'degree'|'certificate'|'years'|'term';
  rule:ScreeningRequirement;
  reason:'suggestExact'|'suggestScoped'|'suggestAmbiguous'|'suggestDegree';
  minimumYears?:number;
}
/** Suggestions never replace the manual source checklist without explicit selection. */
export function suggestImportRule(requirement:string,category:ImportSuggestion['category'],id:string,mandatory=false):ImportSuggestion {
  const rule:ScreeningRequirement={id,requirement,importance:mandatory?'Mandatory':'Important',ruleType:'manual'};
  const suggestion:ImportSuggestion={category,rule,reason:'suggestAmbiguous'};
  const normalized=requirement.trim().replace(/[.]$/,'');
  if(category==='years'){
    const value=normalized.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    const number=value.match(/(?:^|\s|\()(\d{1,2})(?:\))?\s*(?:years?|سنوات|سنة|عام)/i);
    if(number&&Number(number[1])<=60){
      suggestion.minimumYears=Number(number[1]);
      // Domain, geography, seniority and compound durations cannot use total CV years.
      if(/^(?:(?:minimum(?: of)?|at least)\s+)?\d{1,2}\s*(?:years?)(?: of (?:total |professional )?experience)?$/i.test(value)||/^(?:خبرة\s+)?\d{1,2}\s*(?:سنوات|سنة|عام)(?:\s+خبرة)?$/.test(value)){
        rule.ruleType='years';rule.minimumYears=suggestion.minimumYears;suggestion.reason='suggestExact';
      }else suggestion.reason='suggestScoped';
    }
  }else if(category==='certificate'){
    // Only named credentials, never a vendor/product, OR-list or equivalent qualification.
    if(/^(?:MCSE|MCSA|Security\+|Network\+|A\+|CCNA|CCNP|PMP|CISA|CISM|CRISC|CGEIT|ITIL Foundation|CSSA|CLSA)$/i.test(normalized)){
      rule.ruleType='certificate';rule.acceptedTerms=[normalized];suggestion.reason='suggestExact';
    }
  }else if(category==='term'){
    if(normalized.length<=100&&!/[,;،؛]|\b(?:and|or|must|years|experience)\b|(?:خبرة|سنوات|يجب|أو)/i.test(normalized)){
      rule.ruleType='term';rule.acceptedTerms=[normalized];suggestion.reason='suggestExact';
    }
  }else suggestion.reason='suggestDegree'; // Degree plus specialization is a conjunction, not alternative terms.
  return suggestion;
}

export function applyImportSuggestions(checklist:ScreeningRequirement[],suggestions:ImportSuggestion[],selected:string[]):ScreeningRequirement[]{
  const ids=new Set(selected);
  return checklist.map(item=>ids.has(item.id)?{...(suggestions.find(s=>s.rule.id===item.id)?.rule||item)}:{...item});
}
