export interface ApiError extends Error {
  status?: number;
  /** Stable failure code from the server, e.g. 'quota_exceeded'. */
  errorCode?: string;
  /** Raw upstream message, for the technical-details line. */
  errorDetail?: string;
}

export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: any,
  isMultipart = false
): Promise<any> {
  const headers: Record<string, string> = {};

  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }

  const options: RequestInit = {
    method,
    headers,
    credentials: 'same-origin'
  };

  if (body) {
    options.body = isMultipart ? body : JSON.stringify(body);
  }

  const response = await fetch(path, options);

  if (!response.ok) {
    let errMsg = `Request failed: ${response.status} ${response.statusText}`;
    let errorCode: string | undefined;
    let errorDetail: string | undefined;
    try {
      const data = await response.json();
      errMsg = data.error || errMsg;
      // Stable code the caller can translate, plus the raw provider text.
      errorCode = data.errorCode;
      errorDetail = data.errorDetail;
    } catch (e) {}
    const err = new Error(errMsg) as ApiError;
    err.status = response.status;
    err.errorCode = errorCode;
    err.errorDetail = errorDetail;
    throw err;
  }

  return response.json();
}
