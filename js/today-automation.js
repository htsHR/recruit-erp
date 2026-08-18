/* Recruit ERP v11.5.0 TODAY AUTOMATION CLASSIFIER
 * Pure task classification: no storage writes, no personal-data logging.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpTodayAutomation=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const VERSION='11.5.0';
  const STALE_DAYS=14;
  const HIRE_SOON_DAYS=3;
  const FINISHED_STATUSES=new Set(['불합격','서류탈락','면접거절','면접불참','입사철회','철회','연락두절']);
  const FINISHED_DECISIONS=new Set(['불합격','입사포기','입사철회']);
  const INTERVIEW_ACTIVE_STATUSES=new Set(['면접예정','다음면접']);
  const RESULT_PENDING_STATUSES=new Set(['면접예정','다음면접','면접완료']);

  function dateOnly(value){
    if(!value)return '';
    const raw=String(value);
    const matched=raw.match(/^\d{4}-\d{2}-\d{2}/);
    if(matched)return matched[0];
    const parsed=new Date(raw);
    if(Number.isNaN(parsed.getTime()))return '';
    parsed.setMinutes(parsed.getMinutes()-parsed.getTimezoneOffset());
    return parsed.toISOString().slice(0,10);
  }
  function dateDistance(from,to){
    const base=dateOnly(from),target=dateOnly(to);
    if(!base||!target)return null;
    return Math.round((new Date(`${target}T00:00:00`)-new Date(`${base}T00:00:00`))/86400000);
  }
  function latestActivity(row){
    const history=Array.isArray(row?.progressHistory)?row.progressHistory:[];
    const historyDate=history.map(item=>dateOnly(item?.createdAt)).filter(Boolean).sort().pop()||'';
    return historyDate||dateOnly(row?.lastChangedAt)||dateOnly(row?.updatedAt)||dateOnly(row?.createdAt)||dateOnly(row?.lastContactDate)||dateOnly(row?.applyDate)||'';
  }
  function unique(rows){
    const seen=new Set();
    return rows.filter(row=>{
      const id=String(row?.id||'');
      if(!id||seen.has(id))return false;
      seen.add(id);return true;
    });
  }
  function defaultActive(row){
    return !FINISHED_STATUSES.has(String(row?.status||'').trim())&&!FINISHED_DECISIONS.has(String(row?.finalDecision||'').trim());
  }
  function buildGroups(rows,options={}){
    const current=dateOnly(options.today||new Date());
    const active=(Array.isArray(rows)?rows:[]).filter(options.isActive||defaultActive);
    const statusOf=options.normalizeStatus||((value)=>String(value||'').trim());
    const interviewActive=options.isInterviewScheduleActive||((row)=>!!row?.interviewDate&&INTERVIEW_ACTIVE_STATUSES.has(statusOf(row?.status)));
    const hasDecision=options.hasFinalDecision||((row)=>!!String(row?.finalDecision||'').trim());
    const screening=active.filter(row=>statusOf(row.status)==='서류검토');
    const phone=active.filter(row=>statusOf(row.status)==='서류합격');
    const recall=active.filter(row=>statusOf(row.status)==='부재중'&&(!row.nextContactDate||dateOnly(row.nextContactDate)<=current));
    const contact=unique([...phone,...recall]);
    const contactToday=contact.filter(row=>dateOnly(row.nextContactDate)===current);
    const contactOverdue=contact.filter(row=>row.nextContactDate&&dateOnly(row.nextContactDate)<current);
    const interviewToday=active.filter(row=>dateOnly(row.interviewDate)===current&&interviewActive(row));
    const resultPending=active.filter(row=>dateOnly(row.interviewDate)&&dateOnly(row.interviewDate)<current&&RESULT_PENDING_STATUSES.has(statusOf(row.status))&&!hasDecision(row));
    const hireUpcoming=active.filter(row=>{
      const days=dateDistance(current,row.hireDate);
      return statusOf(row.status)==='입사예정'&&days!==null&&days>=0&&days<=HIRE_SOON_DAYS;
    });
    const attendancePending=active.filter(row=>statusOf(row.status)==='입사예정'&&dateOnly(row.hireDate)&&dateOnly(row.hireDate)<current);
    const stagnant=active.filter(row=>{
      const last=latestActivity(row),elapsed=last?dateDistance(last,current):null;
      return elapsed!==null&&elapsed>=STALE_DAYS;
    });
    const overdue=unique([...contactOverdue,...resultPending,...attendancePending]);
    const dueToday=unique([...contactToday,...interviewToday,...hireUpcoming.filter(row=>dateOnly(row.hireDate)===current)]);
    const changedToday=unique(active.filter(row=>latestActivity(row)===current));
    return {
      screening:unique(screening),phone:unique(phone),recall:unique(recall),contact,
      contactToday:unique(contactToday),contactOverdue:unique(contactOverdue),overdue,
      interviewToday:unique(interviewToday),resultPending:unique(resultPending),
      hireUpcoming:unique(hireUpcoming),attendancePending:unique(attendancePending),stagnant:unique(stagnant),
      dueToday,changedToday
    };
  }
  function summary(groups){
    return {
      dueToday:(groups?.dueToday||[]).length,
      overdue:(groups?.overdue||[]).length,
      changedToday:(groups?.changedToday||[]).length,
      urgent:unique([...(groups?.interviewToday||[]),...(groups?.overdue||[])]).length
    };
  }
  const WORKFLOW_REASON_ORDER=['overdue','interviewToday','recall','resultPending','hireUpcoming','stagnant'];
  const WORKFLOW_REASON_META={
    overdue:{label:'기한 경과',tone:'danger',priority:0},
    interviewToday:{label:'오늘 면접',tone:'primary',priority:1},
    recall:{label:'재연락 필요',tone:'contact',priority:2},
    resultPending:{label:'면접 결과 미입력',tone:'danger',priority:3},
    hireUpcoming:{label:'3일 내 입사',tone:'good',priority:4},
    stagnant:{label:`${STALE_DAYS}일 이상 미처리`,tone:'muted',priority:5}
  };
  function workflowReasonDate(reason,row,current){
    if(reason==='overdue')return dateOnly(row?.nextContactDate)||dateOnly(row?.hireDate)||current;
    if(reason==='interviewToday'||reason==='resultPending')return dateOnly(row?.interviewDate)||current;
    if(reason==='recall')return dateOnly(row?.nextContactDate)||current;
    if(reason==='hireUpcoming')return dateOnly(row?.hireDate)||current;
    return latestActivity(row)||current;
  }
  function buildWorkflowRows(rows,options={}){
    const source=Array.isArray(rows)?rows:[];
    const current=dateOnly(options.today||new Date());
    const groups=buildGroups(source,options);
    const overdue=unique([...(groups.contactOverdue||[]),...(groups.attendancePending||[])]);
    const reasonGroups={
      overdue,
      interviewToday:groups.interviewToday||[],
      recall:groups.recall||[],
      resultPending:groups.resultPending||[],
      hireUpcoming:groups.hireUpcoming||[],
      stagnant:groups.stagnant||[]
    };
    const sourceOrder=new Map(source.map((row,index)=>[String(row?.id||''),index]));
    const map=new Map();
    WORKFLOW_REASON_ORDER.forEach(key=>{
      const meta=WORKFLOW_REASON_META[key];
      (reasonGroups[key]||[]).forEach(applicant=>{
        const id=String(applicant?.id||'');
        if(!id)return;
        if(!map.has(id))map.set(id,{applicant,reasons:[],priority:99,sourceIndex:sourceOrder.get(id)??Number.MAX_SAFE_INTEGER});
        const target=map.get(id);
        if(!target.reasons.some(reason=>reason.key===key)){
          target.reasons.push({key,...meta,date:workflowReasonDate(key,applicant,current)});
          target.priority=Math.min(target.priority,meta.priority);
        }
      });
    });
    const result=[...map.values()];
    result.forEach(row=>row.reasons.sort((a,b)=>a.priority-b.priority));
    result.sort((a,b)=>{
      if(a.priority!==b.priority)return a.priority-b.priority;
      const aLast=latestActivity(a.applicant)||'0000-00-00';
      const bLast=latestActivity(b.applicant)||'0000-00-00';
      return aLast.localeCompare(bLast)||a.sourceIndex-b.sourceIndex;
    });
    const workflowSummary={
      dueToday:(groups.dueToday||[]).length,
      overdue:overdue.length,
      changedToday:(groups.changedToday||[]).length,
      urgent:unique([...overdue,...(groups.interviewToday||[])]).length
    };
    return {groups,rows:result,summary:workflowSummary};
  }
  return {VERSION,STALE_DAYS,HIRE_SOON_DAYS,WORKFLOW_REASON_ORDER,WORKFLOW_REASON_META,dateOnly,dateDistance,latestActivity,unique,buildGroups,buildWorkflowRows,summary};
});
