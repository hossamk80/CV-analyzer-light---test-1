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
    try {
      const data = await response.json();
      errMsg = data.error || errMsg;
    } catch (e) {}
    const err = new Error(errMsg) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return response.json();
}
