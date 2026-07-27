// TEMPORARY local mock for manual QA of frontend/app/pages/claim/[token].vue.
// Real endpoint belongs in backend/ — remove this file once that exists.
export default defineEventHandler((event) => {
  const auth = getHeader(event, 'authorization')
  if (!auth?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Missing session' })
  }
  return { success: true }
})
