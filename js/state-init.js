// Recruit ERP v12.0.2 — state is read only after the one-time reset gate succeeds.
window.erpStateReady=Promise.resolve(window.erpFactoryResetReady).then(reset=>{
  if(!reset?.ok)return {ok:false};
  // Retired modules are no longer rendered, but their untouched datasets remain
  // loaded so a full backup can still round-trip every pre-v12.5.0 record.
  schools=readArrayFromStorageKey(SCHOOLS_KEY);
  employees=readArrayFromStorageKey(EMPLOYEES_KEY);
  applicants=load();
  calendarEvents=typeof loadCalendarEvents==='function'?loadCalendarEvents():readArrayFromStorageKey(CALENDAR_EVENTS_KEY);
  hireWaitingProfiles=readArrayFromStorageKey(HIRE_WAITING_PROFILES_KEY);
  messageTemplates=readArrayFromStorageKey(MESSAGE_TEMPLATES_KEY);
  return {ok:true};
});
