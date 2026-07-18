// Recruit ERP v10.40.8 — integrated runtime state initialization
// All function declarations are loaded before data is normalized and rendered.
schools = loadSchools();
employees = loadEmployees();
applicants = load();
calendarEvents = loadCalendarEvents();
console.info('[HOME_DEV] Recruit ERP v10.40.8 loaded applicants:', applicants.length);
