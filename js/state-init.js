// Recruit ERP v10.40.29 — integrated runtime state initialization
// All function declarations are loaded before data is normalized and rendered.
schools = loadSchools();
employees = loadEmployees();
applicants = load();
calendarEvents = loadCalendarEvents();
hireWaitingProfiles = loadHireWaitingProfiles();
messageTemplates = typeof loadMessageTemplates==='function' ? loadMessageTemplates() : [];
console.info('[HOME_DEV] Recruit ERP v10.47.3 loaded applicants:', applicants.length, 'hire waiting profiles:', hireWaitingProfiles.length, 'message templates:', messageTemplates.length);
