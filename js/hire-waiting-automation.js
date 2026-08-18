/* =========================================================
   Recruit ERP v11.2.1 — 입사대기 사번·비고 자동작성
   - 월 전체 입사예정자를 대상으로 결정론적 사번을 계산한다.
   - 미리보기 계산은 전달받은 배열과 브라우저 저장소를 변경하지 않는다.
   ========================================================= */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.erpHireWaitingAutomation=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const EMPLOYEE_NO_MAX=999;
  const HEIGHT_MIN=100;
  const HEIGHT_MAX=250;
  const WEIGHT_MIN=30;
  const WEIGHT_MAX=250;
  const koreanCollator=new Intl.Collator('ko-KR',{usage:'sort',sensitivity:'base',numeric:true});

  function text(value){return String(value==null?'':value).trim();}
  function rawText(value){return String(value==null?'':value);}
  function employeeNoKey(value){return text(value).toUpperCase();}
  function hasOwn(value,key){return !!value&&Object.prototype.hasOwnProperty.call(value,key);}

  function strictBirthDate(value){
    const raw=text(value);
    let parts=null;
    if(/^\d{8}$/.test(raw))parts=[raw.slice(0,4),raw.slice(4,6),raw.slice(6,8)];
    else{
      const match=raw.match(/^(\d{4})[-./](\d{2})[-./](\d{2})$/);
      if(match)parts=match.slice(1);
    }
    if(!parts)return '';
    const year=Number(parts[0]),month=Number(parts[1]),day=Number(parts[2]);
    if(year<1000||month<1||month>12||day<1||day>31)return '';
    const date=new Date(Date.UTC(year,month-1,day));
    if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)return '';
    return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function monthFromSelectedDate(value){
    const raw=text(value),match=raw.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if(!match)return '';
    const year=Number(match[1]),month=Number(match[2]);
    if(year<1000||month<1||month>12)return '';
    if(match[3]&&!strictBirthDate(`${match[1]}-${match[2]}-${match[3]}`))return '';
    return `${match[1]}-${match[2]}`;
  }

  function normalizeApplicantStatus(value,normalizer){
    if(typeof normalizer==='function'){
      try{return text(normalizer(value));}catch(_error){return text(value);}
    }
    const status=text(value);
    return ({입사포기:'입사철회',포기:'입사철회',취소:'철회'})[status]||status;
  }

  function linkedEmployee(applicant,employees){
    const applicantId=text(applicant?.id),employeeId=text(applicant?.employeeId);
    if(employeeId&&employeeId!=='수동처리'){
      const direct=employees.find(employee=>text(employee?.id)===employeeId);
      if(direct)return direct;
    }
    return employees.find(employee=>applicantId&&text(employee?.applicantId)===applicantId)||null;
  }

  function compareKorean(left,right){
    const a=rawText(left),b=rawText(right),comp=koreanCollator.compare(a,b);
    return comp||a.localeCompare(b,'en');
  }

  function candidateOrder(left,right){
    return left.birthDate.localeCompare(right.birthDate)
      ||compareKorean(left.name,right.name)
      ||text(left.applicantId).localeCompare(text(right.applicantId),'en');
  }

  function previewOrder(left,right){
    return text(left.hireDate).localeCompare(text(right.hireDate),'en')
      ||(left.birthDate||'9999-99-99').localeCompare(right.birthDate||'9999-99-99','en')
      ||compareKorean(left.name,right.name)
      ||text(left.applicantId).localeCompare(text(right.applicantId),'en');
  }

  function measurement(value,min,max){
    const raw=text(value);
    if(!raw)return{raw:'',empty:true,valid:false,value:null,display:''};
    if(!/^(?:\d+|\d+\.\d+)$/.test(raw))return{raw,empty:false,valid:false,value:null,display:raw};
    const number=Number(raw);
    if(!Number.isFinite(number)||number<min||number>max)return{raw,empty:false,valid:false,value:null,display:raw};
    return{raw,empty:false,valid:true,value:number,display:String(number)};
  }

  function remarkPlan(applicant,profile,draft){
    const existingRemarks=rawText(profile?.remarks);
    if(existingRemarks.length){
      return{
        currentRemarks:existingRemarks,proposedRemarks:existingRemarks,autoRemarks:'',remarkAction:'수기 비고 유지',
        heightCm:text(profile?.heightCm),weightKg:text(profile?.weightKg),needsMeasurements:false,
        measurementsStorable:false,measurementInvalid:false,measurementIncomplete:false
      };
    }
    const careerType=text(applicant?.careerType),career=text(applicant?.career);
    if(careerType.includes('경력')){
      return{
        currentRemarks:'',proposedRemarks:career,autoRemarks:career,remarkAction:career?'경력사항 자동작성':'경력사항 확인 필요',
        heightCm:text(profile?.heightCm),weightKg:text(profile?.weightKg),needsMeasurements:false,
        measurementsStorable:false,measurementInvalid:false,measurementIncomplete:false
      };
    }
    if(!careerType.includes('신입')){
      return{
        currentRemarks:'',proposedRemarks:'',autoRemarks:'',remarkAction:'자료 없음',
        heightCm:text(profile?.heightCm),weightKg:text(profile?.weightKg),needsMeasurements:false,
        measurementsStorable:false,measurementInvalid:false,measurementIncomplete:false
      };
    }
    const heightRaw=hasOwn(draft,'heightCm')?draft.heightCm:profile?.heightCm;
    const weightRaw=hasOwn(draft,'weightKg')?draft.weightKg:profile?.weightKg;
    const height=measurement(heightRaw,HEIGHT_MIN,HEIGHT_MAX),weight=measurement(weightRaw,WEIGHT_MIN,WEIGHT_MAX);
    const invalid=(!height.empty&&!height.valid)||(!weight.empty&&!weight.valid);
    const complete=height.valid&&weight.valid;
    const incomplete=(height.valid&&!weight.valid)||(weight.valid&&!height.valid);
    const autoRemarks=complete?`${height.display}cm/${weight.display}kg`:'';
    return{
      currentRemarks:'',proposedRemarks:autoRemarks,autoRemarks,
      remarkAction:autoRemarks?'키·체중 자동작성':invalid?'키·체중 범위 확인 필요':incomplete?'키·체중 모두 입력 필요':'키·체중 선택 입력',
      heightCm:height.raw,weightKg:weight.raw,needsMeasurements:true,measurementsStorable:complete,
      measurementInvalid:invalid,measurementIncomplete:incomplete
    };
  }

  function nextAvailableNumber(prefix,used,cursor){
    let sequence=Math.max(1,Number(cursor)||1);
    while(sequence<=EMPLOYEE_NO_MAX){
      const value=`${prefix}${String(sequence).padStart(3,'0')}`;
      sequence++;
      if(!used.has(employeeNoKey(value)))return{value,next:sequence};
    }
    return{value:'',next:EMPLOYEE_NO_MAX+1};
  }

  function emptyPlan(month,message){
    return{ok:false,month:month||'',prefix:'',rows:[],summary:{total:0,existingNumber:0,assignedNumber:0,needsBirth:0,automatedRemarks:0,manualRemarks:0},errors:[message]};
  }

  function planAutomation({selectedDate,applicants=[],profiles=[],employees=[],draftMeasurements={},normalizeStatus}={}){
    const month=monthFromSelectedDate(selectedDate);
    if(!month)return emptyPlan('','입사월을 확인할 수 없습니다.');
    const safeApplicants=Array.isArray(applicants)?applicants:[];
    const safeProfiles=Array.isArray(profiles)?profiles:[];
    const safeEmployees=Array.isArray(employees)?employees:[];
    const profileById=new Map(safeProfiles.map(profile=>[text(profile?.applicantId),profile]));
    const used=new Set();
    safeProfiles.forEach(profile=>{const key=employeeNoKey(profile?.employeeNo);if(key)used.add(key);});
    safeEmployees.forEach(employee=>{const key=employeeNoKey(employee?.empNo);if(key)used.add(key);});
    const targets=safeApplicants.filter(applicant=>
      applicant&&normalizeApplicantStatus(applicant.status,normalizeStatus)==='입사예정'&&text(applicant.hireDate).startsWith(`${month}-`)
    );
    const bases=targets.map(applicant=>{
      const applicantId=text(applicant.id),profile=profileById.get(applicantId)||{};
      const linked=linkedEmployee(applicant,safeEmployees);
      const profileNumber=text(profile.employeeNo),linkedNumber=text(linked?.empNo);
      return{
        applicant,profile,applicantId,name:text(applicant.name),hireDate:text(applicant.hireDate),
        birthDate:strictBirthDate(applicant.birthYear),currentEmployeeNo:profileNumber||linkedNumber,
        proposedEmployeeNo:profileNumber||linkedNumber,numberAction:profileNumber||linkedNumber?'기존 사번 유지':''
      };
    });
    const candidates=bases.filter(row=>!row.currentEmployeeNo&&row.birthDate).sort(candidateOrder);
    const prefix=`S${month.slice(2,4)}${month.slice(5,7)}`;
    let cursor=1;
    candidates.forEach(row=>{
      const allocated=nextAvailableNumber(prefix,used,cursor);
      cursor=allocated.next;
      row.proposedEmployeeNo=allocated.value;
      row.numberAction=allocated.value?'자동채번':'사번 범위 확인 필요';
      if(allocated.value)used.add(employeeNoKey(allocated.value));
    });
    bases.filter(row=>!row.currentEmployeeNo&&!row.birthDate).forEach(row=>{row.numberAction='생년월일 확인 필요';});

    const errors=[];
    const rows=bases.map(base=>{
      const draft=draftMeasurements&&draftMeasurements[base.applicantId]&&typeof draftMeasurements[base.applicantId]==='object'
        ?draftMeasurements[base.applicantId]:{};
      const remarks=remarkPlan(base.applicant,base.profile,draft);
      if(remarks.measurementInvalid)errors.push(`${base.applicantId}: 키 또는 체중 범위를 확인해주세요.`);
      if(!base.currentEmployeeNo&&base.birthDate&&!base.proposedEmployeeNo)errors.push(`${base.applicantId}: 해당 월 사번 999개가 모두 사용 중입니다.`);
      const statusParts=[base.numberAction,remarks.remarkAction].filter(Boolean);
      return{
        applicantId:base.applicantId,name:base.name,hireDate:base.hireDate,birthDate:base.birthDate,
        currentEmployeeNo:base.currentEmployeeNo,proposedEmployeeNo:base.proposedEmployeeNo,
        willAssignNumber:!base.currentEmployeeNo&&!!base.proposedEmployeeNo,numberAction:base.numberAction,
        ...remarks,status:statusParts.join(' · ')
      };
    }).sort(previewOrder);
    const generated=new Set();
    rows.filter(row=>row.willAssignNumber).forEach(row=>{
      const key=employeeNoKey(row.proposedEmployeeNo);
      if(used.has(key)&&generated.has(key))errors.push(`${row.applicantId}: 자동사번 중복이 감지되었습니다.`);
      generated.add(key);
    });
    const summary={
      total:rows.length,
      existingNumber:rows.filter(row=>!!row.currentEmployeeNo).length,
      assignedNumber:rows.filter(row=>row.willAssignNumber).length,
      needsBirth:rows.filter(row=>!row.currentEmployeeNo&&!row.birthDate).length,
      automatedRemarks:rows.filter(row=>!!row.autoRemarks).length,
      manualRemarks:rows.filter(row=>row.remarkAction==='수기 비고 유지').length
    };
    return{ok:errors.length===0,month,prefix,rows,summary,errors};
  }

  function buildNextProfiles({plan,profiles=[],employees=[],now}={}){
    if(!plan||!Array.isArray(plan.rows))return{ok:false,code:'INVALID_PLAN',message:'자동작성 미리보기를 다시 열어주세요.'};
    if(plan.errors?.length)return{ok:false,code:'INVALID_INPUT',message:'입력값을 확인해주세요.',errors:[...plan.errors]};
    const source=Array.isArray(profiles)?profiles:[];
    const safeEmployees=Array.isArray(employees)?employees:[];
    const usedBefore=new Set();
    source.forEach(profile=>{const key=employeeNoKey(profile?.employeeNo);if(key)usedBefore.add(key);});
    safeEmployees.forEach(employee=>{const key=employeeNoKey(employee?.empNo);if(key)usedBefore.add(key);});
    const generated=new Set();
    for(const row of plan.rows){
      if(row.willAssignNumber){
        if(!strictBirthDate(row.birthDate))return{ok:false,code:'INVALID_BIRTH',message:'생년월일 확인이 필요한 대상에는 사번을 부여할 수 없습니다.'};
        const key=employeeNoKey(row.proposedEmployeeNo);
        if(!key||usedBefore.has(key)||generated.has(key))return{ok:false,code:'DUPLICATE_EMPLOYEE_NUMBER',message:'중복 사번이 감지되어 적용을 중단했습니다.'};
        generated.add(key);
      }
      if(row.measurementInvalid)return{ok:false,code:'INVALID_MEASUREMENT',message:'키 또는 체중 입력 범위를 확인해주세요.'};
    }

    const stamp=now||new Date().toISOString();
    const next=source.map(profile=>({...profile}));
    const indexById=new Map(next.map((profile,index)=>[text(profile?.applicantId),index]));
    let numberChanges=0,remarkChanges=0,measurementChanges=0;
    plan.rows.forEach(row=>{
      const index=indexById.get(text(row.applicantId));
      const current=index===undefined?{applicantId:text(row.applicantId)}:next[index];
      const updated={...current};
      let changed=false;
      if(!text(current.employeeNo)&&row.willAssignNumber){updated.employeeNo=row.proposedEmployeeNo;numberChanges++;changed=true;}
      if(rawText(current.remarks).length===0&&row.autoRemarks){updated.remarks=row.autoRemarks;remarkChanges++;changed=true;}
      if(rawText(current.remarks).length===0&&row.needsMeasurements&&row.measurementsStorable){
        const height=text(row.heightCm),weight=text(row.weightKg);
        if(text(current.heightCm)!==height){updated.heightCm=height;measurementChanges++;changed=true;}
        if(text(current.weightKg)!==weight){updated.weightKg=weight;measurementChanges++;changed=true;}
      }
      if(!changed)return;
      updated.applicantId=text(row.applicantId);
      updated.createdAt=current.createdAt||stamp;
      updated.updatedAt=stamp;
      if(index===undefined){indexById.set(updated.applicantId,next.length);next.push(updated);}
      else next[index]=updated;
    });
    return{ok:true,profiles:next,numberChanges,remarkChanges,measurementChanges,changed:numberChanges+remarkChanges+measurementChanges>0};
  }

  function executeApply({plan,profiles=[],employees=[],persist,now}={}){
    const original=Array.isArray(profiles)?profiles:[];
    const prepared=buildNextProfiles({plan,profiles:original,employees,now});
    if(!prepared.ok)return{...prepared,profiles:original};
    if(!prepared.changed)return{...prepared,persisted:false};
    if(typeof persist!=='function')return{ok:false,code:'PERSIST_UNAVAILABLE',message:'저장 기능을 사용할 수 없습니다.',profiles:original};
    try{
      if(persist(prepared.profiles)!==true)return{ok:false,code:'SAVE_FAILED',message:'저장에 실패해 변경 전 상태를 유지했습니다.',profiles:original};
      return{...prepared,persisted:true};
    }catch(_error){
      return{ok:false,code:'SAVE_FAILED',message:'저장에 실패해 변경 전 상태를 유지했습니다.',profiles:original};
    }
  }

  return{
    EMPLOYEE_NO_MAX,HEIGHT_MIN,HEIGHT_MAX,WEIGHT_MIN,WEIGHT_MAX,
    strictBirthDate,monthFromSelectedDate,planAutomation,buildNextProfiles,executeApply
  };
});
