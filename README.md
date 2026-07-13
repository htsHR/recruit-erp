# Recruit ERP v10.35.0 — Normalized Source

This folder is functionally equivalent to the GitHub snapshot, but JavaScript is restored to normal files:

- `index.html`
- `app.js`
- `supabase_config.js`
- `css/*.css`

No 50 KB splitting rule is used in this folder.

## Important

The current source still contains the legacy synchronization behavior:

- localStorage is saved before Supabase completes.
- whole arrays are upserted.
- cloud and local arrays are automatically merged on load.
- employee and school reads are not yet safely paginated beyond 1,000 rows.

Do not run the employee/school recovery import until synchronization stabilization is implemented and tested.
