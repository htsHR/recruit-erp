// Recruit ERP v12.0.2 — state is read only after the one-time reset gate succeeds.
window.erpStateReady=Promise.resolve(window.erpFactoryResetReady).then(reset=>{
  if(!reset?.ok)return {ok:false};
  schools=loadSchools();
  employees=loadEmployees();
  applicants=load();
  calendarEvents=loadCalendarEvents();
  hireWaitingProfiles=loadHireWaitingProfiles();
  messageTemplates=typeof loadMessageTemplates==='function'?loadMessageTemplates():[];
  return {ok:true};
});
