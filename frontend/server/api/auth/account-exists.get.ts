// TEMPORARY local mock for manual QA of frontend/app/pages/claim/[token].vue.
// Real endpoint belongs in backend/ — remove this file once that exists.
export default defineEventHandler((event) => {
  const query = getQuery(event)
  const email = String(query.email ?? '')
  return { exists: email.includes('existing') }
})
