/* Recruit ERP v11.1.0 - school workforce analytics core */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpSchoolWorkforceAnalytics=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const STATUS={active:'재직중',leave:'휴직',retired:'퇴사',upcoming:'입사예정'};
  const DIMENSIONS={
    hireYear:{label:'입사연도',value:row=>yearOf(row.hireDate)},
    leaveYear:{label:'퇴사연도',value:row=>yearOf(row.leaveDate)},
    promotionYear:{label:'승격연도',value:row=>yearOf(row.promotionDate)},
    status:{label:'재직상태',value:row=>row.status==='재직중'?'재직':row.status==='퇴사'?'퇴직':row.status},
    rankFamily:{label:'직급계열',value:row=>row.rankFamily},
    rankExact:{label:'정확한 직급',value:row=>row.rank},
    rankStep:{label:'직급단계',value:row=>row.rankStep==null?'단계 없음':String(row.rankStep)},
    position:{label:'직책',value:row=>row.position},
    role:{label:'직책/직무',value:row=>row.role},
    team:{label:'팀',value:row=>row.team},
    groupName:{label:'그룹',value:row=>row.groupName},
    product:{label:'제품',value:row=>row.product},
    part:{label:'파트',value:row=>row.part},
    recruitType:{label:'입사경위',value:row=>row.recruitType},
    recruitChannel:{label:'채용채널',value:row=>row.recruitChannel},
    education:{label:'최종학력',value:row=>row.education},
    major:{label:'전공',value:row=>row.major},
    gender:{label:'성별',value:row=>row.gender}
  };
  const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});

  function text(value){return String(value??'').normalize('NFKC').trim();}
  function meaningful(value){const valueText=text(value);return !!valueText&&!['-','–','—','없음','해당없음','null','undefined'].includes(valueText.toLowerCase());}
  function datePartsValid(year,month,day){
    const y=Number(year),m=Number(month),d=Number(day);
    if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d)||y<1900||y>2100||m<1||m>12||d<1||d>31)return false;
    const check=new Date(Date.UTC(y,m-1,d));
    return check.getUTCFullYear()===y&&check.getUTCMonth()===m-1&&check.getUTCDate()===d;
  }
  function isoDate(year,month,day){return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
  function parseWorkbookDate(input,options={}){
    if(input===null||input===undefined||!meaningful(input))return{value:'',valid:true,blank:true,source:'blank'};
    let value=input;
    if(options.periodStart&&typeof value==='string')value=value.split(/[~～]/)[0].trim();
    if(value instanceof Date){
      if(Number.isNaN(value.getTime()))return{value:'',valid:false,blank:false,source:'date',reason:'유효하지 않은 날짜'};
      const y=value.getFullYear(),m=value.getMonth()+1,d=value.getDate();
      return datePartsValid(y,m,d)?{value:isoDate(y,m,d),valid:true,blank:false,source:'date'}:{value:'',valid:false,blank:false,source:'date',reason:'날짜 범위 오류'};
    }
    if(typeof value==='number'){
      if(!Number.isFinite(value)||value<1)return{value:'',valid:false,blank:false,source:'excel',reason:'Excel 날짜 일련번호 오류'};
      const date=new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000);
      const y=date.getUTCFullYear(),m=date.getUTCMonth()+1,d=date.getUTCDate();
      return datePartsValid(y,m,d)?{value:isoDate(y,m,d),valid:true,blank:false,source:'excel'}:{value:'',valid:false,blank:false,source:'excel',reason:'Excel 날짜 범위 오류'};
    }
    const raw=text(value),digits=raw.replace(/\D/g,'');
    let match=null;
    if(/^\d{8}$/.test(digits))match=[digits.slice(0,4),digits.slice(4,6),digits.slice(6,8)];
    else if(/^\d{6}$/.test(digits))match=[String(2000+Number(digits.slice(0,2))),digits.slice(2,4),digits.slice(4,6)];
    else{
      const parsed=raw.match(/^(\d{2}|\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
      if(parsed)match=[parsed[1].length===2?String(2000+Number(parsed[1])):parsed[1],parsed[2],parsed[3]];
    }
    if(!match||!datePartsValid(...match))return{value:'',valid:false,blank:false,source:'text',reason:'지원하지 않거나 유효하지 않은 날짜'};
    return{value:isoDate(...match),valid:true,blank:false,source:'text'};
  }
  function validIsoDate(value){const parsed=parseWorkbookDate(value);return parsed.valid&&!parsed.blank&&parsed.value===text(value);}
  function yearOf(value){return validIsoDate(value)?text(value).slice(0,4):'';}
  function referenceIso(value){const parsed=parseWorkbookDate(value||new Date());return parsed.valid&&!parsed.blank?parsed.value:isoDate(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate());}

  function parseRank(value){
    const raw=text(value);
    if(!raw)return{raw:'',family:'미입력',step:null,parsed:false};
    const compact=raw.replace(/\s+/g,'');
    const match=compact.match(/^([A-Za-z]+\d+)(?:-(\d+))?$/);
    if(!match)return{raw,family:'기타',step:null,parsed:false};
    return{raw,family:match[1],step:match[2]===undefined?null:Number(match[2]),parsed:true};
  }
  function normalizeEmployeeStatus(value,leaveDate=''){
    const raw=text(value);
    if(['재직','재직자','재직중'].includes(raw))return STATUS.active;
    if(['휴직','휴직자'].includes(raw))return STATUS.leave;
    if(['퇴직','퇴직자','퇴사'].includes(raw))return STATUS.retired;
    if(['입사예정','입사예정자'].includes(raw))return STATUS.upcoming;
    return meaningful(leaveDate)?STATUS.retired:raw;
  }
  function normalizeSchoolName(value){return text(value).toLocaleLowerCase('ko-KR').replace(/[\s\u00a0()（）\[\]{}]+/g,'');}
  function schoolVariantKey(value){
    const key=normalizeSchoolName(value);if(!key||/(?:고등학교|고교|마이스터고|특성화고|공업고|상업고|일반고)$/.test(key))return'';
    const suffix=['전문대학교','전문대학','대학교','전문대','대학','대'].find(item=>key.endsWith(item));if(!suffix)return'';
    const base=key.slice(0,-suffix.length);return base.length>=2?base:'';
  }
  function schoolIndexes(schools=[]){
    const byId=new Map(),byName=new Map(),byAlias=new Map(),byVariant=new Map();
    function add(map,key,school){if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(school);}
    for(const school of schools){
      const id=text(school?.id);if(!id)continue;byId.set(id,school);
      const name=normalizeSchoolName(school.name);add(byName,name,school);add(byVariant,schoolVariantKey(school.name),school);
      for(const alias of Array.isArray(school.aliases)?school.aliases:[]){add(byAlias,normalizeSchoolName(alias),school);add(byVariant,schoolVariantKey(alias),school);}
    }
    return{byId,byName,byAlias,byVariant};
  }
  function uniqueSchools(list=[]){const map=new Map();for(const school of list)if(school?.id)map.set(String(school.id),school);return[...map.values()];}
  function resolveSchoolMatch({currentSchoolId='',incomingSchool='',schools=[]}={}){
    const indexes=schoolIndexes(schools),current=indexes.byId.get(text(currentSchoolId))||null,key=normalizeSchoolName(incomingSchool);
    let candidates=uniqueSchools(indexes.byName.get(key)||[]),matchType='name';
    if(!candidates.length){candidates=uniqueSchools(indexes.byAlias.get(key)||[]);matchType='alias';}
    if(!candidates.length){const variant=schoolVariantKey(incomingSchool);candidates=uniqueSchools(indexes.byVariant.get(variant)||[]);matchType=variant?'variant':'';}
    if(current){
      if(!key)return{status:'preserved',schoolId:text(current.id),school:current};
      if(candidates.length===1&&text(candidates[0].id)===text(current.id))return{status:'preserved',schoolId:text(current.id),school:current,candidates,matchType};
      if(candidates.length>1)return{status:'ambiguous',schoolId:text(current.id),school:current,candidates,matchType};
      return{status:'conflict',schoolId:text(current.id),school:current,candidates,matchType};
    }
    if(!key)return{status:'missing',schoolId:'',school:null,candidates:[]};
    if(candidates.length===1)return{status:'matched',schoolId:text(candidates[0].id),school:candidates[0],candidates,matchType};
    if(candidates.length>1)return{status:'ambiguous',schoolId:'',school:null,candidates,matchType};
    return{status:'unresolved',schoolId:'',school:null,candidates:[]};
  }
  function schoolSearchTerms(school){const names=[school?.name,...(Array.isArray(school?.aliases)?school.aliases:[])].filter(Boolean);return[...new Set(names.flatMap(name=>[text(name),normalizeSchoolName(name),schoolVariantKey(name)]).filter(Boolean))];}

  function isActualEmployee(employee,asOf){
    const status=normalizeEmployeeStatus(employee?.status,employee?.leaveDate),date=parseWorkbookDate(employee?.hireDate),ref=referenceIso(asOf);
    return !!text(employee?.schoolId)&&date.valid&&!date.blank&&date.value<=ref&&[STATUS.active,STATUS.leave,STATUS.retired].includes(status);
  }
  function isActiveEmployee(employee){return normalizeEmployeeStatus(employee?.status,employee?.leaveDate)===STATUS.active;}
  function isLeaveEmployee(employee){return normalizeEmployeeStatus(employee?.status,employee?.leaveDate)===STATUS.leave;}
  function isRetiredEmployee(employee){return normalizeEmployeeStatus(employee?.status,employee?.leaveDate)===STATUS.retired;}
  function convertedApplicantIds(employees=[]){const ids=new Set();for(const employee of employees){const id=text(employee?.applicantId);if(id)ids.add(id);}return ids;}
  function isUpcomingApplicant(applicant,{employees=[],asOf}={}){
    const ref=referenceIso(asOf),date=parseWorkbookDate(applicant?.hireDate),linkedIds=convertedApplicantIds(employees),employeeById=new Set(employees.map(row=>text(row?.id)).filter(Boolean));
    const converted=linkedIds.has(text(applicant?.id))||(text(applicant?.employeeId)&&employeeById.has(text(applicant.employeeId)));
    return !converted&&!!text(applicant?.schoolId)&&normalizeEmployeeStatus(applicant?.status)===STATUS.upcoming&&date.valid&&!date.blank&&date.value>ref;
  }
  function employeeRow(employee,schoolMap,asOf){
    const rank=parseRank(employee?.rank),school=schoolMap.get(text(employee?.schoolId));
    return{
      kind:'employee',personKey:`employee:${text(employee?.id)||text(employee?.empNo)}`,id:text(employee?.id),employeeId:text(employee?.id),applicantId:text(employee?.applicantId),
      empNo:text(employee?.empNo),name:text(employee?.name),status:normalizeEmployeeStatus(employee?.status,employee?.leaveDate),
      hireDate:parseWorkbookDate(employee?.hireDate).value,leaveDate:parseWorkbookDate(employee?.leaveDate).value,promotionDate:parseWorkbookDate(employee?.promotionDate).value,
      rank:rank.raw,rankFamily:rank.family,rankStep:rank.step,rankParsed:rank.parsed,
      position:text(employee?.position),role:text(employee?.role),team:text(employee?.team||employee?.department),groupName:text(employee?.groupName),product:text(employee?.product),part:text(employee?.part),
      recruitType:text(employee?.recruitType),recruitChannel:text(employee?.recruitChannel),education:text(employee?.education),major:text(employee?.major),gender:text(employee?.gender),
      schoolId:text(employee?.schoolId),school:text(school?.name||employee?.school),schoolSearchTerms:schoolSearchTerms(school||{name:employee?.school}),actualHire:isActualEmployee(employee,asOf),upcoming:false,source:employee
    };
  }
  function applicantRow(applicant,profile,schoolMap){
    const rank=parseRank(profile?.rank),school=schoolMap.get(text(applicant?.schoolId));
    return{
      kind:'applicant',personKey:`applicant:${text(applicant?.id)}`,id:text(applicant?.id),employeeId:'',applicantId:text(applicant?.id),
      empNo:text(profile?.employeeNo),name:text(applicant?.name),status:STATUS.upcoming,hireDate:parseWorkbookDate(applicant?.hireDate).value,leaveDate:'',promotionDate:'',
      rank:rank.raw,rankFamily:rank.family,rankStep:rank.step,rankParsed:rank.parsed,position:'',role:'',team:text(profile?.groupName||applicant?.workplace),groupName:text(profile?.groupName),product:text(profile?.product),part:text(profile?.part),
      recruitType:text(applicant?.source),recruitChannel:text(applicant?.source),education:text(applicant?.education||applicant?.finalEducation),major:text(applicant?.major),gender:text(applicant?.gender),
      schoolId:text(applicant?.schoolId),school:text(school?.name||applicant?.school),schoolSearchTerms:schoolSearchTerms(school||{name:applicant?.school}),actualHire:false,upcoming:true,source:applicant
    };
  }
  function buildSchoolWorkforce({employees=[],applicants=[],profiles=[],schools=[],asOf}={}){
    const schoolMap=new Map(schools.map(row=>[text(row?.id),row])),profileMap=new Map(profiles.map(row=>[text(row?.applicantId),row]));
    const employeeRows=employees.map(row=>employeeRow(row,schoolMap,asOf));
    const upcomingRows=applicants.filter(row=>isUpcomingApplicant(row,{employees,asOf})).map(row=>applicantRow(row,profileMap.get(text(row?.id))||{},schoolMap));
    return{employeeRows,upcomingRows,rows:[...employeeRows.filter(row=>row.actualHire),...upcomingRows]};
  }

  function inDateRange(value,start,end){if(!value)return!start&&!end;if(start&&value<start)return false;if(end&&value>end)return false;return true;}
  function inYearRange(value,start,end){const year=yearOf(value);if(!year)return!start&&!end;if(start&&year<String(start))return false;if(end&&year>String(end))return false;return true;}
  function setFilter(value,expected){if(!expected||expected==='all'||(Array.isArray(expected)&&!expected.length))return true;const list=Array.isArray(expected)?expected:[expected];return list.map(text).includes(text(value));}
  function filterSchoolWorkforce(rows=[],filters={}){
    const query=text(filters.search).toLocaleLowerCase('ko-KR');
    return rows.filter(row=>{
      if(!setFilter(row.schoolId,filters.schoolId||filters.schoolIds))return false;
      if(!setFilter(row.status,filters.statuses))return false;
      if(!inDateRange(row.hireDate,text(filters.hireDateFrom),text(filters.hireDateTo)))return false;
      if(!inYearRange(row.hireDate,filters.hireYearFrom,filters.hireYearTo))return false;
      if(!inDateRange(row.leaveDate,text(filters.leaveDateFrom),text(filters.leaveDateTo)))return false;
      if(!inYearRange(row.leaveDate,filters.leaveYearFrom,filters.leaveYearTo))return false;
      if(!inDateRange(row.promotionDate,text(filters.promotionDateFrom),text(filters.promotionDateTo)))return false;
      if(!inYearRange(row.promotionDate,filters.promotionYearFrom,filters.promotionYearTo))return false;
      const fieldFilters={rankFamily:'rankFamilies',rank:'ranks',rankStep:'rankSteps',position:'positions',role:'roles',team:'teams',groupName:'groups',product:'products',part:'parts',recruitType:'recruitTypes',recruitChannel:'recruitChannels',education:'educations',major:'majors',gender:'genders'};
      for(const [field,key] of Object.entries(fieldFilters))if(!setFilter(row[field]??'',filters[key]))return false;
      if(query){const regular=[row.empNo,row.name,row.school,row.rank,row.position,row.role,row.team,row.groupName,row.product,row.part,row.major].some(value=>text(value).toLocaleLowerCase('ko-KR').includes(query)),queryKey=normalizeSchoolName(query),queryVariant=schoolVariantKey(query),schoolMatch=(row.schoolSearchTerms||[]).some(term=>normalizeSchoolName(term).includes(queryKey)||(queryVariant&&schoolVariantKey(term)===queryVariant));if(!regular&&!schoolMatch)return false;}
      return true;
    });
  }
  function uniqueRows(rows=[]){const map=new Map();for(const row of rows){const key=text(row?.personKey)||`${row?.kind||'row'}:${text(row?.id)||text(row?.empNo)}`;if(key&&!map.has(key))map.set(key,row);}return[...map.values()];}
  function dimensionValue(row,dimension){const config=DIMENSIONS[dimension];if(!config)throw new Error(`지원하지 않는 집계 기준: ${dimension}`);return text(config.value(row))||'미입력';}
  function groupWorkforceRows(rows=[],dimension='status'){
    const map=new Map();for(const row of uniqueRows(rows)){const key=dimensionValue(row,dimension);map.set(key,(map.get(key)||0)+1);}
    return[...map.entries()].map(([key,count])=>({key,count})).sort((a,b)=>b.count-a.count||collator.compare(a.key,b.key));
  }
  function buildCrossTab(rows=[],rowDimension='status',columnDimension='rankFamily'){
    const unique=uniqueRows(rows),rowLabels=[...new Set(unique.map(row=>dimensionValue(row,rowDimension)))].sort(collator.compare),columnLabels=[...new Set(unique.map(row=>dimensionValue(row,columnDimension)))].sort(collator.compare);
    const counts=new Map();for(const row of unique){const r=dimensionValue(row,rowDimension),c=dimensionValue(row,columnDimension),key=`${r}\u0000${c}`;counts.set(key,(counts.get(key)||0)+1);}
    const matrix=rowLabels.map(r=>columnLabels.map(c=>counts.get(`${r}\u0000${c}`)||0));
    const rowTotals=matrix.map(values=>values.reduce((sum,value)=>sum+value,0));
    const columnTotals=columnLabels.map((_,index)=>matrix.reduce((sum,values)=>sum+values[index],0));
    const grandTotal=unique.length;
    return{rowDimension,columnDimension,rowLabels,columnLabels,matrix,rowTotals,columnTotals,grandTotal,totalsMatch:rowTotals.reduce((a,b)=>a+b,0)===grandTotal&&columnTotals.reduce((a,b)=>a+b,0)===grandTotal};
  }
  function buildSchoolSummary(rows=[]){
    const unique=uniqueRows(rows);return{
      total:unique.length,actualHires:unique.filter(row=>row.actualHire).length,upcoming:unique.filter(row=>row.upcoming).length,
      active:unique.filter(row=>row.kind==='employee'&&row.status===STATUS.active).length,leave:unique.filter(row=>row.kind==='employee'&&row.status===STATUS.leave).length,retired:unique.filter(row=>row.kind==='employee'&&row.status===STATUS.retired).length
    };
  }
  function buildYearlyHireSummary(rows=[]){return groupWorkforceRows(uniqueRows(rows).filter(row=>row.actualHire),'hireYear');}
  function dynamicFilterValues(rows=[],field){return[...new Set(rows.map(row=>row[field]).filter(value=>value!==''&&value!==null&&value!==undefined).map(String))].sort(collator.compare);}
  function safeSpreadsheetText(value){const raw=String(value??'');return /^[=+\-@]/.test(raw)?`'${raw}`:raw;}

  return{STATUS,DIMENSIONS,text,meaningful,parseWorkbookDate,validIsoDate,yearOf,parseRank,normalizeEmployeeStatus,normalizeSchoolName,schoolVariantKey,schoolSearchTerms,resolveSchoolMatch,isActualEmployee,isActiveEmployee,isLeaveEmployee,isRetiredEmployee,isUpcomingApplicant,buildSchoolWorkforce,filterSchoolWorkforce,uniqueRows,groupWorkforceRows,buildCrossTab,buildSchoolSummary,buildYearlyHireSummary,dynamicFilterValues,safeSpreadsheetText};
});
