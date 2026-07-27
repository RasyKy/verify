// TEMPORARY local mock for manual QA of frontend/app/pages/claim/[token].vue.
// Real endpoint belongs in backend/ — remove this file once that exists.
export default defineEventHandler((event) => {
  const token = getRouterParam(event, 'token') ?? ''

  const base = {
    studentName: 'Sokha Chan',
    courseName: 'Full-Stack Web Development',
    institutionName: 'Royal University of Phnom Penh',
    email: 'sokha.chan@example.com',
  }

  if (token.startsWith('expired-')) {
    return { valid: true, expired: true, used: false, ...base }
  }
  if (token.startsWith('used-')) {
    return { valid: true, expired: false, used: true, ...base }
  }
  if (token.startsWith('valid-existing-')) {
    return { valid: true, expired: false, used: false, ...base, email: 'existing.holder@example.com' }
  }
  if (token.startsWith('valid-')) {
    return { valid: true, expired: false, used: false, ...base }
  }

  return { valid: false, expired: false, used: false, studentName: '', courseName: '', institutionName: '', email: '' }
})
