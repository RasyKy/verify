/**
 * Authenticated calls to the backend API.
 *
 * Must be called from a setup function or middleware: it resolves the Nuxt
 * composables it needs up front and closes over them, so the function it
 * returns is safe to call later, after any number of awaits. Resolving them
 * lazily inside the request would throw "A composable that requires access to
 * the Nuxt instance was called outside of..." during SSR.
 */
export function useApi() {
  const supabase = useSupabaseClient()
  const { public: config } = useRuntimeConfig()

  /**
   * @throws FetchError — `err.data.error.message` carries the backend's
   * user-safe message (see backend/src/middleware/errorHandler.js); `err.status`
   * the code. Callers are expected to surface that rather than a generic
   * failure, because messages like "This certificate has already been revoked"
   * are the whole point of the error contract.
   */
  return async function apiFetch<T>(
    path: string,
    options: Parameters<typeof $fetch<T>>[1] = {},
  ): Promise<T> {
    // Read the token per request, not once: it is refreshed in the background
    // and a captured copy would go stale on a long-lived page.
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    return $fetch<T>(path, {
      baseURL: config.apiBase,
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers as Record<string, string> | undefined),
      },
    })
  }
}

/** Pulls the backend's user-safe message out of a failed apiFetch. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const data = (err as { data?: { error?: { message?: string } } })?.data
  return data?.error?.message ?? fallback
}
