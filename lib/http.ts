export class HttpError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}
// The deadline includes reading the response body.
export async function request<T>(url: string, init: RequestInit = {}, timeout = 30000, json = true): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const ok = response.ok;
    const body = await response.text();
    let data;
    try { data = body ? JSON.parse(body) : {}; }
    catch {
      if (!ok || json) console.error("[HTTP_RESPONSE] Non-JSON server response.");
      if (!ok) throw new HttpError(body.slice(0, 500) || `Request failed (${response.status}).`, response.status);
      if (json) throw new HttpError("The server returned a non-JSON response. Please try again.", response.status);
    }
    if (!ok) throw new HttpError(data?.error || data?.message || `Request failed (${response.status}).`, response.status, data?.code);
    return data as T;
  } catch (error) {
    console.error("[HTTP_REQUEST] Request failed or exceeded its deadline.");
    if (controller.signal.aborted) throw new HttpError("Request timed out. Please try again.", 408);
    throw error;
  } finally { clearTimeout(timer); }
}
export const timedFetch: typeof fetch = (input, init) => fetch(input, {
  ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
});

// Auth requests get a real transport deadline; an OAuth navigation gets none.
export const authFetch: typeof fetch = async (input, init) => {
  const timeout = AbortSignal.timeout(30000);
  try {
    return await fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
  } catch (error) {
    const message = timeout.aborted ? "Supabase authentication request timed out after 30 seconds. Please retry."
      : error instanceof TypeError ? "Network error reaching Supabase" : "Supabase authentication request was interrupted.";
    console.error("[SUPABASE_AUTH_FETCH]", message);
    throw new Error(message);
  }
};
