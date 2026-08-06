/* Recruit ERP v11.1.0 - safe employee master XLSX import and XLSX export */
(function(root,factory){
  const analytics=typeof module==='object'&&module.exports?require('./school-workforce-analytics.js'):root.erpSchoolWorkforceAnalytics;
  const api=factory(root,analytics);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpEmployeeMasterXlsx=api;
})(typeof window!=='undefined'?window:globalThis,function(root,analytics){
  'use strict';

  if(!analytics)throw new Error('학교 인력분석 공통 모듈이 필요합니다.');
  const FORMAT_VERSION='11.1.0';
  const ALLOWED_SHEETS={
    '(주)에이치티솔루션 사원명부':{type:'active',status:'재직중'},
    '휴직자 명단':{type:'leave',status:'휴직'},
    '퇴직자 현황':{type:'retired',status:'퇴사'}
  };
  const SPECIAL_SHEET='특수직';
  const READABLE_SHEETS=new Set([...Object.keys(ALLOWED_SHEETS),SPECIAL_SHEET]);
  const UPDATE_FIELDS=[
    'gender','team','groupName','product','part','rank','position','role','promotionDate','recruitType','recruitChannel','education','major',
    'leaveStartDate','school','hireDate','leaveDate','status'
  ];
  const FIELD_LABELS={gender:'성별',team:'팀',groupName:'그룹',product:'제품',part:'파트',rank:'직급',position:'직책',role:'직책/직무',promotionDate:'승격일',recruitType:'입사경위',recruitChannel:'채용채널',education:'최종학력',major:'전공',leaveStartDate:'휴직 시작일',school:'학교',schoolId:'학교 연결',hireDate:'입사일',leaveDate:'퇴사일',status:'재직상태'};
  const encoder=new TextEncoder();

  function safeText(value){return String(value??'').normalize('NFKC').trim();}
  function meaningful(value){return analytics.meaningful(value);}
  function headerKey(value){return safeText(value).replace(/[\s\n\r·/\\()_-]+/g,'').toLocaleLowerCase('ko-KR');}
  function employeeNo(value){return safeText(value).replace(/\s+/g,'').toUpperCase();}
  function personName(value){return safeText(value).replace(/\s+/g,'').toLocaleLowerCase('ko-KR');}
  function xmlDecode(value){return String(value??'').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');}
  function xmlEscape(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
  function attribute(tag,name){const match=String(tag).match(new RegExp(`(?:^|\\s)${name.replace(':','\\:')}="([^"]*)"`));return match?xmlDecode(match[1]):'';}

  function columnIndex(reference){const letters=(String(reference||'').match(/[A-Z]+/i)||['A'])[0].toUpperCase();let value=0;for(const letter of letters)value=value*26+(letter.charCodeAt(0)-64);return value-1;}
  function columnName(index){let value=index+1,out='';while(value){const rest=(value-1)%26;out=String.fromCharCode(65+rest)+out;value=Math.floor((value-1)/26);}return out;}
  function decodeBytes(bytes){return new TextDecoder('utf-8').decode(bytes);}
  async function inflate(bytes){
    if(typeof DecompressionStream!=='function')throw new Error('현재 환경이 XLSX 압축 해제를 지원하지 않습니다. 최신 Chrome 또는 Edge에서 다시 시도해주세요.');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function zipEntries(arrayBuffer){
    const bytes=new Uint8Array(arrayBuffer),view=new DataView(arrayBuffer);let eocd=-1;
    for(let index=bytes.length-22;index>=Math.max(0,bytes.length-65557);index--){if(view.getUint32(index,true)===0x06054b50){eocd=index;break;}}
    if(eocd<0)throw new Error('유효한 XLSX ZIP 구조를 찾지 못했습니다.');
    const count=view.getUint16(eocd+10,true);if(count>5000)throw new Error('XLSX 내부 파일 수가 안전 한도를 초과했습니다.');
    const centralOffset=view.getUint32(eocd+16,true);let position=centralOffset;const entries=new Map();
    for(let index=0;index<count;index++){
      if(position+46>bytes.length||view.getUint32(position,true)!==0x02014b50)throw new Error('XLSX 중앙 디렉터리가 손상되었습니다.');
      const method=view.getUint16(position+10,true),compressedSize=view.getUint32(position+20,true),uncompressedSize=view.getUint32(position+24,true),nameLength=view.getUint16(position+28,true),extraLength=view.getUint16(position+30,true),commentLength=view.getUint16(position+32,true),localOffset=view.getUint32(position+42,true);
      if(compressedSize>50*1024*1024||uncompressedSize>100*1024*1024)throw new Error('XLSX 내부 파일 크기가 안전 한도를 초과했습니다.');
      const name=decodeBytes(bytes.slice(position+46,position+46+nameLength));
      if(localOffset+30>bytes.length||view.getUint32(localOffset,true)!==0x04034b50)throw new Error('XLSX 내부 파일 구조가 손상되었습니다.');
      const localNameLength=view.getUint16(localOffset+26,true),localExtraLength=view.getUint16(localOffset+28,true),dataStart=localOffset+30+localNameLength+localExtraLength;
      entries.set(name,{method,compressed:bytes.slice(dataStart,dataStart+compressedSize),uncompressedSize});
      position+=46+nameLength+extraLength+commentLength;
    }
    async function read(name){const entry=entries.get(name);if(!entry)return null;if(entry.method===0)return entry.compressed;if(entry.method===8)return inflate(entry.compressed);throw new Error('지원하지 않는 XLSX 압축 방식입니다.');}
    return{entries,read};
  }
  function normalizePath(target){const clean=String(target||'').replace(/^\//,'');if(clean.startsWith('xl/'))return clean;const parts=['xl'];for(const part of clean.split('/')){if(part==='..')parts.pop();else if(part&&part!=='.')parts.push(part);}return parts.join('/');}
  function workbookSheets(xml){
    const rows=[];for(const match of String(xml).matchAll(/<sheet\b[^>]*\/?\s*>/gi)){const tag=match[0],name=attribute(tag,'name'),relId=attribute(tag,'r:id');if(name&&relId)rows.push({name,relId});}return rows;
  }
  function relationshipMap(xml){const map=new Map();for(const match of String(xml).matchAll(/<Relationship\b[^>]*\/?\s*>/gi)){const tag=match[0],id=attribute(tag,'Id'),target=attribute(tag,'Target');if(id&&target)map.set(id,normalizePath(target));}return map;}
  function sharedStrings(xml){
    const values=[];for(const match of String(xml||'').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)){const textParts=[...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map(item=>xmlDecode(item[1]));values.push(textParts.join(''));if(values.length>500000)throw new Error('XLSX 공유문자열 수가 안전 한도를 초과했습니다.');}return values;
  }
  function cellValue(cellTag,body,shared){
    const type=attribute(cellTag,'t'),content=String(body||''),formula=/<f\b/i.test(content),valueMatch=content.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i),hasCachedValue=!!valueMatch;
    if(type==='e')return{value:'',kind:'error',formula,hasCachedValue};
    if(formula&&!hasCachedValue)return{value:'',kind:'formula-missing-cache',formula:true,hasCachedValue:false};
    let value='';
    if(type==='inlineStr')value=[...content.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map(item=>xmlDecode(item[1])).join('');
    else{
      const raw=valueMatch?xmlDecode(valueMatch[1]):'';
      if(type==='s')value=shared[Number(raw)]??'';
      else if(type==='b')value=raw==='1';
      else if(type==='str')value=raw;
      else{const number=Number(raw);value=raw!==''&&Number.isFinite(number)?number:raw;}
    }
    return{value,kind:formula?'formula-cached':(value===''?'empty':'value'),formula,hasCachedValue};
  }
  function worksheetRows(xml,shared,{maxRows=20000,maxColumns=80}={}){
    const output=[],cellStates=[];let seen=0;
    for(const match of String(xml).matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)){
      if(++seen>maxRows)throw new Error('허용 시트의 실제 데이터 행 수가 안전 한도를 초과했습니다.');
      const rowTag=`<row ${match[1]}>`,rowIndex=Math.max(0,(Number(attribute(rowTag,'r'))||output.length+1)-1),values=[],states=[];
      for(const cell of match[2].matchAll(/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c\s*>)/gi)){
        const tag=`<c ${cell[1]}>`,index=columnIndex(attribute(tag,'r'));if(index>=maxColumns)continue;
        const parsed=cellValue(tag,cell[2]||'',shared);values[index]=parsed.value;states[index]={kind:parsed.kind,formula:parsed.formula,hasCachedValue:parsed.hasCachedValue};
      }
      output[rowIndex]=values;cellStates[rowIndex]=states;
    }
    return{rows:output,cellStates};
  }
  function referenceLabel(value){return safeText(value).replace(/[\s:\uFF1A]+/g,'').toLocaleLowerCase('ko-KR');}
  function referenceFallback(options={}){
    const direct=analytics.parseWorkbookDate(options.fallbackDate);if(direct.valid&&!direct.blank)return{date:direct.value,source:'provided-fallback'};
    if(Number(options.lastModified)>0){const modified=new Date(Number(options.lastModified));if(!Number.isNaN(modified.getTime()))return{date:modified.toISOString().slice(0,10),source:'file-last-modified'};}
    return{date:new Date().toISOString().slice(0,10),source:'browser-today'};
  }
  function detectWorkbookReferenceDate(workbook,options={}){
    const found=[],issues=[];
    for(const sheet of workbook?.sheets||[]){
      if(!READABLE_SHEETS.has(sheet.name))continue;
      const rows=sheet.rows||[],states=sheet.cellStates||[];
      for(let rowIndex=0;rowIndex<Math.min(12,rows.length);rowIndex++){
        const row=rows[rowIndex]||[];
        for(let column=0;column<row.length;column++){
          if(referenceLabel(row[column])!=='오늘날짜')continue;
          const state=states[rowIndex]?.[column+1],parsed=analytics.parseWorkbookDate(row[column+1]);
          if(state?.kind==='error'){issues.push({type:'reference-date',sourceSheet:sheet.name,sourceRow:rowIndex+1,reason:'명단 기준일 셀이 오류 상태입니다.'});continue;}
          if(state?.kind==='formula-missing-cache'){issues.push({type:'reference-date',sourceSheet:sheet.name,sourceRow:rowIndex+1,reason:'명단 기준일 수식에 캐시값이 없습니다.'});continue;}
          if(!parsed.valid||parsed.blank){issues.push({type:'reference-date',sourceSheet:sheet.name,sourceRow:rowIndex+1,reason:'명단 기준일을 날짜로 확인할 수 없습니다.'});continue;}
          found.push({sheet:sheet.name,date:parsed.value});
        }
      }
    }
    const dates=[...new Set(found.map(item=>item.date))],fallback=referenceFallback(options);
    if(dates.length>1)return{date:'',suggestedDate:fallback.date,source:'workbook',foundSheets:[...new Set(found.map(item=>item.sheet))],conflict:true,missing:false,issues:[...issues,{type:'reference-date',sourceSheet:'',sourceRow:0,reason:'시트 사이의 명단 기준일이 서로 달라 적용할 수 없습니다.'}]};
    if(dates.length===1)return{date:dates[0],suggestedDate:dates[0],source:'workbook',foundSheets:[...new Set(found.map(item=>item.sheet))],conflict:false,missing:false,issues};
    return{date:fallback.date,suggestedDate:fallback.date,source:fallback.source,foundSheets:[],conflict:false,missing:true,issues:[...issues,{type:'reference-date',sourceSheet:'',sourceRow:0,reason:'워크북에서 명단 기준일을 찾지 못해 확인이 필요합니다.'}]};
  }
  async function sha256Hex(arrayBuffer){
    if(!root.crypto?.subtle)return'';const digest=await root.crypto.subtle.digest('SHA-256',arrayBuffer);return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  async function readWorkbookArrayBuffer(arrayBuffer,options={}){
    if(!(arrayBuffer instanceof ArrayBuffer))throw new Error('XLSX 파일 데이터가 필요합니다.');
    const zip=await zipEntries(arrayBuffer),workbookBytes=await zip.read('xl/workbook.xml'),relsBytes=await zip.read('xl/_rels/workbook.xml.rels');
    if(!workbookBytes||!relsBytes)throw new Error('XLSX 통합문서 정보를 찾지 못했습니다.');
    const sheetRefs=workbookSheets(decodeBytes(workbookBytes)),rels=relationshipMap(decodeBytes(relsBytes));
    const sharedBytes=await zip.read('xl/sharedStrings.xml'),shared=sharedBytes?sharedStrings(decodeBytes(sharedBytes)):[];
    const sheets=[];
    for(const sheet of sheetRefs){
      if(!READABLE_SHEETS.has(sheet.name))continue;
      const path=rels.get(sheet.relId),bytes=path?await zip.read(path):null;if(!bytes)continue;
      const parsed=worksheetRows(decodeBytes(bytes),shared);sheets.push({name:sheet.name,rows:parsed.rows,cellStates:parsed.cellStates});
    }
    const result={format:'xlsx',version:FORMAT_VERSION,sheets,availableSheets:sheetRefs.map(sheet=>sheet.name),readSheets:sheets.map(sheet=>sheet.name)};
    result.referenceDate=detectWorkbookReferenceDate(result,options);return result;
  }
  async function readWorkbookFile(file){
    if(!file||typeof file.arrayBuffer!=='function')throw new Error('읽을 XLSX 파일이 없습니다.');
    if(!String(file.name||'').toLowerCase().endsWith('.xlsx'))throw new Error('.xlsx 파일만 사용할 수 있습니다.');
    if(Number(file.size)>20*1024*1024)throw new Error('20MB 이하의 XLSX 파일만 사용할 수 있습니다.');
    const arrayBuffer=await file.arrayBuffer(),workbook=await readWorkbookArrayBuffer(arrayBuffer,{lastModified:file.lastModified});
    workbook.fileBaseName=safeText(file.name);workbook.workbookHash=await sha256Hex(arrayBuffer);return workbook;
  }

  function findHeaderRow(rows){for(let index=0;index<Math.min(12,rows.length);index++){const keys=(rows[index]||[]).map(headerKey);if(keys.includes('사원번호')&&keys.includes('성명'))return index;}return-1;}
  function headerMap(row){const map=new Map();(row||[]).forEach((value,index)=>{const key=headerKey(value);if(key&&!map.has(key))map.set(key,index);});return map;}
  function rowCell(row,states,map,aliases){for(const alias of aliases){const index=map.get(headerKey(alias));if(index!==undefined)return{value:row[index],state:states?.[index]||null};}return{value:'',state:null};}
  function rowValue(row,map,aliases){return rowCell(row,null,map,aliases).value;}
  function nonEmptyRow(row,states=[]){return(Array.isArray(row)?row:[]).some(meaningful)||(Array.isArray(states)?states:[]).some(state=>state&&['error','formula-missing-cache','formula-cached'].includes(state.kind));}
  function dateField(value,label,options){const parsed=analytics.parseWorkbookDate(value,options);return{value:parsed.value,issue:parsed.valid?null:`${label}: ${parsed.reason||'날짜 형식 오류'}`,blank:parsed.blank};}
  function mappedRecord(row,map,source,sourceRow,states=[]){
    const validationIssues=[];
    function read(aliases,label){const cell=rowCell(row,states,map,aliases);if(cell.state?.kind==='error')validationIssues.push(`${label} 셀에 수식 또는 값 오류가 있습니다.`);else if(cell.state?.kind==='formula-missing-cache')validationIssues.push(`${label} 수식에 캐시값이 없습니다.`);return cell.value;}
    const hire=dateField(read(['입사일'],'입사일'),'입사일'),leave=dateField(read(['퇴사일'],'퇴사일'),'퇴사일'),promotion=dateField(read(['승격일'],'승격일'),'승격일'),leaveStart=source.type==='leave'?dateField(read(['휴직기간','휴직일'],'휴직기간'),'휴직기간',{periodStart:true}):{value:'',issue:null,blank:true};
    const position=safeText(read(['직책'],'직책')),role=safeText(read(['직책/직무','직책직무'],'직책/직무'));
    return{
      sourceSheet:source.name,sourceRow,sourceType:source.type,special:source.special,
      empNo:employeeNo(read(['사원번호','사번'],'사번')),name:safeText(read(['성명','이름'],'성명')),
      gender:safeText(read(['성별'],'성별')),team:safeText(read(source.type==='retired'?['소속','팀']:['팀','소속'],'팀')),groupName:safeText(read(['그룹'],'그룹')),product:safeText(read(['제품','근무/제품','근무제품'],'제품')),part:safeText(read(['파트'],'파트')),rank:safeText(read(['직급'],'직급')),position,role,
      hireDate:hire.value,leaveDate:leave.value,leaveStartDate:leaveStart.value,promotionDate:promotion.value,status:source.status,
      recruitType:safeText(read(['입사경위'],'입사경위')),recruitChannel:safeText(read(['채용채널','입사루트'],'채용채널')),education:safeText(read(['최종학력'],'최종학력')),school:safeText(read(['최종학교','출신학교','학교'],'최종학교')),major:safeText(read(['전공'],'전공')),
      validationIssues:[...validationIssues,hire.issue,leave.issue,promotion.issue,leaveStart.issue].filter(Boolean)
    };
  }
  function recordsFromSheet(sheet){
    const config=ALLOWED_SHEETS[sheet.name];if(!config)return{records:[],issues:[],summary:null};
    const headerIndex=findHeaderRow(sheet.rows||[]);if(headerIndex<0)return{records:[],issues:[{type:'sheet',sourceSheet:sheet.name,sourceRow:0,reason:'사원번호·성명 머리글을 찾지 못했습니다.'}],summary:{name:sheet.name,rows:0,status:'error'}};
    const map=headerMap(sheet.rows[headerIndex]),records=[],issues=[];
    for(let index=headerIndex+1;index<(sheet.rows||[]).length;index++){
      const row=sheet.rows[index]||[],states=sheet.cellStates?.[index]||[];if(!nonEmptyRow(row,states))continue;
      const record=mappedRecord(row,map,{...config,name:sheet.name,special:false},index+1,states);records.push(record);
    }
    return{records,issues,summary:{name:sheet.name,rows:records.length,status:'ready'}};
  }
  function inspectSpecialSheet(sheet){
    if(!sheet)return{present:false,dataRows:0,linkableRows:0,excludedRows:0,records:[],issues:[]};
    let headerIndex=-1;for(let index=0;index<Math.min(12,(sheet.rows||[]).length);index++){const keys=(sheet.rows[index]||[]).map(headerKey);if(keys.includes('성명')){headerIndex=index;break;}}
    if(headerIndex<0)return{present:true,dataRows:0,linkableRows:0,excludedRows:0,records:[],issues:[{type:'special',sourceSheet:SPECIAL_SHEET,sourceRow:0,reason:'특수직 머리글을 찾지 못했습니다.'}]};
    const map=headerMap(sheet.rows[headerIndex]),hasEmpNo=map.has('사원번호')||map.has('사번'),hasSchool=['최종학교','출신학교','학교'].some(key=>map.has(headerKey(key))),records=[],issues=[];let dataRows=0,excludedRows=0;
    for(let index=headerIndex+1;index<(sheet.rows||[]).length;index++){
      const row=sheet.rows[index]||[],states=sheet.cellStates?.[index]||[];if(!nonEmptyRow(row,states))continue;dataRows++;
      if(!hasEmpNo||!hasSchool){excludedRows++;continue;}
      const record=mappedRecord(row,map,{type:'special',status:'',name:SPECIAL_SHEET,special:true},index+1,states);
      if(!record.empNo||!record.school){excludedRows++;issues.push({type:'special',sourceSheet:SPECIAL_SHEET,sourceRow:index+1,reason:'특수직 행에 사번 또는 학교가 없어 자동 연결할 수 없습니다.'});continue;}
      records.push(record);
    }
    if(dataRows&&!hasEmpNo)issues.push({type:'special',sourceSheet:SPECIAL_SHEET,sourceRow:headerIndex+1,reason:'특수직 시트에 사번 열이 없어 자동 신규 생성과 병합을 금지합니다.'});
    if(dataRows&&!hasSchool)issues.push({type:'special',sourceSheet:SPECIAL_SHEET,sourceRow:headerIndex+1,reason:'특수직 시트에 학교 열이 없어 학교분석에서 제외합니다.'});
    return{present:true,dataRows,linkableRows:records.length,excludedRows,records,issues,hasEmpNo,hasSchool};
  }
  function extractWorkbookRecords(workbook){
    const byName=new Map((workbook?.sheets||[]).map(sheet=>[sheet.name,sheet])),records=[],issues=[],sourceSummary=[];
    for(const name of Object.keys(ALLOWED_SHEETS)){const result=recordsFromSheet(byName.get(name)||{name,rows:[]});records.push(...result.records);issues.push(...result.issues);sourceSummary.push(result.summary);}
    const special=inspectSpecialSheet(byName.get(SPECIAL_SHEET));records.push(...special.records);issues.push(...special.issues);
    const referenceDate=workbook?.referenceDate||detectWorkbookReferenceDate(workbook);issues.push(...(referenceDate.issues||[]));
    return{records,issues,sourceSummary,special,availableSheets:workbook?.availableSheets||[],referenceDate,workbookHash:workbook?.workbookHash||'',fileBaseName:workbook?.fileBaseName||''};
  }

  function rowIssue(record,reason,type='error'){return{type,sourceSheet:record?.sourceSheet||'',sourceRow:record?.sourceRow||0,reason};}
  function currentEmployeeMap(employees=[]){const map=new Map();for(const employee of employees){const key=employeeNo(employee?.empNo);if(!key)continue;if(!map.has(key))map.set(key,[]);map.get(key).push(employee);}return map;}
  function meaningfulPatch(record){const patch={};for(const field of UPDATE_FIELDS)if(meaningful(record[field]))patch[field]=record[field];if(Object.prototype.hasOwnProperty.call(patch,'team'))patch.department=patch.team;return patch;}
  function changedFields(existing,patch){return Object.keys(patch).filter(field=>String(existing?.[field]??'')!==String(patch[field]??''));}
  function validateRecord(record,asOf){
    const errors=[...(record.validationIssues||[])];
    if(!record.empNo)errors.push('사번이 비어 있습니다.');if(!record.name)errors.push('성명이 비어 있습니다.');
    if(!record.special&&!record.hireDate)errors.push('입사일이 비어 있거나 유효하지 않습니다.');
    if(record.sourceType==='leave'&&!record.leaveStartDate)errors.push('휴직기간 시작일이 비어 있거나 유효하지 않습니다.');
    if(record.sourceType==='retired'&&!record.leaveDate)errors.push('퇴사일이 비어 있거나 유효하지 않습니다.');
    if(record.hireDate&&record.hireDate>asOf&&['재직중','휴직','퇴사'].includes(record.status))errors.push('실제 입사 상태의 입사일이 기준일 이후입니다.');
    if(record.hireDate&&record.leaveDate&&record.leaveDate<record.hireDate)errors.push('퇴사일이 입사일보다 빠릅니다.');
    return errors;
  }
  function buildImportPlan({records=[],employees=[],schools=[],asOf,now,idFactory}={}){
    const reference=analytics.parseWorkbookDate(asOf||new Date()).value,stamp=now||new Date().toISOString(),makeId=idFactory||(()=>root.crypto?.randomUUID?.()||`employee-${Date.now()}-${Math.random().toString(36).slice(2)}`),sourceCounts=new Map(),existingMap=currentEmployeeMap(employees);
    for(const record of records){const key=employeeNo(record.empNo);if(key)sourceCounts.set(key,(sourceCounts.get(key)||0)+1);}
    const next=employees.slice(),rows=[],issues=[],changedEmployees=[];let added=0,updated=0,unchanged=0,blocked=0,schoolNeeds=0;
    for(const record of records){
      const errors=validateRecord(record,reference),key=employeeNo(record.empNo),matches=key?(existingMap.get(key)||[]):[];
      if(key&&(sourceCounts.get(key)||0)>1)errors.push('파일 내부 또는 시트 사이에 같은 사번이 중복되어 있습니다.');
      if(matches.length>1)errors.push('ERP 사원명부에 같은 사번이 중복되어 있습니다.');
      const existing=matches.length===1?matches[0]:null;
      if(existing&&personName(existing.name)!==personName(record.name))errors.push('사번은 같지만 성명이 일치하지 않습니다.');
      if(record.special&&!record.school)errors.push('특수직 행에 학교가 없어 안전한 연결이 불가능합니다.');
      if(errors.length){blocked++;const problem={record,existing,status:'blocked',errors,changes:[]};rows.push(problem);errors.forEach(reason=>issues.push(rowIssue(record,reason)));continue;}
      const schoolResolution=analytics.resolveSchoolMatch({currentSchoolId:existing?.schoolId||'',incomingSchool:record.school,schools});
      const patch=meaningfulPatch(record);
      if(schoolResolution.status==='matched'){patch.schoolId=schoolResolution.schoolId;patch.school=record.school;}
      else if(schoolResolution.status==='preserved'){patch.schoolId=schoolResolution.schoolId;if(record.school)patch.school=record.school;}
      else if(['conflict','ambiguous','unresolved','missing'].includes(schoolResolution.status)){
        delete patch.schoolId;
        if(schoolResolution.status==='conflict')delete patch.school;
        schoolNeeds++;issues.push(rowIssue(record,schoolResolution.status==='conflict'?'기존 schoolId와 엑셀 학교가 달라 자동 교체하지 않았습니다.':'학교를 정확히 한 곳에 연결하지 못해 학교분석에서 제외됩니다.','school'));
      }
      if(existing){
        const changes=changedFields(existing,patch);if(!changes.length){unchanged++;rows.push({record,existing,status:'same',errors:[],changes:[],schoolResolution});continue;}
        const updatedEmployee={...existing,...patch,id:existing.id,createdAt:existing.createdAt,applicantId:existing.applicantId,notes:existing.notes,returnDate:existing.returnDate,updatedAt:stamp};
        const index=next.findIndex(row=>String(row.id)===String(existing.id));next[index]=updatedEmployee;changedEmployees.push(updatedEmployee);updated++;rows.push({record,existing,employee:updatedEmployee,status:'updated',errors:[],changes:changes.map(field=>({field,label:FIELD_LABELS[field]||field,from:existing[field]??'',to:updatedEmployee[field]??''})),schoolResolution});
      }else{
        const created={...patch,id:makeId(),empNo:key,name:record.name,createdAt:stamp,updatedAt:stamp,applicantId:'',notes:'',returnDate:'',schoolId:patch.schoolId||''};
        next.unshift(created);changedEmployees.push(created);existingMap.set(key,[created]);added++;rows.push({record,existing:null,employee:created,status:'new',errors:[],changes:UPDATE_FIELDS.filter(field=>meaningful(created[field])).map(field=>({field,label:FIELD_LABELS[field]||field,from:'',to:created[field]})),schoolResolution});
      }
    }
    return{nextEmployees:next,changedEmployees,rows,issues,summary:{total:records.length,added,updated,unchanged,blocked,schoolNeeds},referenceDate:reference,createdAt:stamp};
  }

  function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
  function u16(value){const bytes=new Uint8Array(2);new DataView(bytes.buffer).setUint16(0,value,true);return bytes;}
  function u32(value){const bytes=new Uint8Array(4);new DataView(bytes.buffer).setUint32(0,value>>>0,true);return bytes;}
  function concat(parts){const size=parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;}
  function zipStore(files){
    const locals=[],centrals=[];let offset=0;
    for(const file of files){const name=encoder.encode(file.name),data=typeof file.data==='string'?encoder.encode(file.data):file.data,crc=crc32(data);const local=concat([u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);locals.push(local);centrals.push(concat([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));offset+=local.length;}
    const central=concat(centrals),end=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(central.length),u32(offset),u16(0)]);return concat([...locals,central,end]);
  }
  function cellXml(value,row,column,header=false){
    const ref=`${columnName(column)}${row}`;if(typeof value==='number'&&Number.isFinite(value))return`<c r="${ref}" s="${header?1:0}"><v>${value}</v></c>`;
    const safe=analytics.safeSpreadsheetText(value),space=/^\s|\s$/.test(safe)?' xml:space="preserve"':'';return`<c r="${ref}" t="inlineStr" s="${header?1:0}"><is><t${space}>${xmlEscape(safe)}</t></is></c>`;
  }
  function worksheetXml(sheet){
    const rows=[sheet.headers||[],...(sheet.rows||[])],lastColumn=columnName(Math.max(0,(sheet.headers||[]).length-1)),widths=(sheet.widths||[]).map((width,index)=>`<col min="${index+1}" max="${index+1}" width="${Math.max(8,Math.min(40,Number(width)||14))}" customWidth="1"/>`).join('');
    const data=rows.map((row,index)=>`<row r="${index+1}"${index===0?' ht="24" customHeight="1"':''}>${row.map((value,column)=>cellXml(value,index+1,column,index===0)).join('')}</row>`).join('');
    return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${data}</sheetData>${rows.length&&sheet.headers?.length?`<autoFilter ref="A1:${lastColumn}${rows.length}"/>`:''}</worksheet>`;
  }
  function sanitizeSheetName(name,index){const clean=safeText(name).replace(/[\\/*?:\[\]]/g,' ').slice(0,31);return clean||`Sheet${index+1}`;}
  function createXlsxBytes(sheets=[]){
    if(!Array.isArray(sheets)||!sheets.length)throw new Error('XLSX에 넣을 시트가 없습니다.');
    const names=[],used=new Set();for(let index=0;index<sheets.length;index++){let name=sanitizeSheetName(sheets[index].name,index),base=name,suffix=1;while(used.has(name)){name=`${base.slice(0,27)}_${suffix++}`;}used.add(name);names.push(name);}
    const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,index)=>`<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name,index)=>`<sheet name="${xmlEscape(name)}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join('')}</sheets></workbook>`;
    const workbookRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Noto Sans CJK KR"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Noto Sans CJK KR"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs></styleSheet>`;
    const files=[{name:'[Content_Types].xml',data:contentTypes},{name:'_rels/.rels',data:rootRels},{name:'xl/workbook.xml',data:workbook},{name:'xl/_rels/workbook.xml.rels',data:workbookRels},{name:'xl/styles.xml',data:styles}];
    sheets.forEach((sheet,index)=>files.push({name:`xl/worksheets/sheet${index+1}.xml`,data:worksheetXml(sheet)}));return zipStore(files);
  }
  function createXlsxBlob(sheets){return new Blob([createXlsxBytes(sheets)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
  function downloadXlsx(filename,sheets){const blob=createXlsxBlob(sheets),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename.endsWith('.xlsx')?filename:`${filename}.xlsx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return{filename:link.download,size:blob.size};}

  return{FORMAT_VERSION,ALLOWED_SHEETS,SPECIAL_SHEET,READABLE_SHEETS,UPDATE_FIELDS,FIELD_LABELS,headerKey,employeeNo,personName,cellValue,parseWorksheetXml:worksheetRows,detectWorkbookReferenceDate,readWorkbookArrayBuffer,readWorkbookFile,findHeaderRow,headerMap,recordsFromSheet,inspectSpecialSheet,extractWorkbookRecords,buildImportPlan,createXlsxBytes,createXlsxBlob,downloadXlsx};
});
