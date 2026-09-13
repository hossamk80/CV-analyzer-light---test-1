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
  const headers: Record<string, string> = { 'Accept-Language': document.documentElement.lang || 'ar' };

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
    if ((document.documentElement.lang || 'ar') === 'ar' && !/[ء-ي]/.test(errMsg)) {
      errMsg = response.status === 401 ? 'انتهت الجلسة أو يلزم تسجيل الدخول.'
        : response.status === 403 ? 'ليست لديك صلاحية لتنفيذ هذا الإجراء.'
        : response.status === 404 ? 'تعذر العثور على البيانات المطلوبة.'
        : response.status === 429 ? 'تم تجاوز عدد المحاولات المسموح. حاول لاحقًا.'
        : response.status >= 500 ? 'حدث خطأ في الخادم. حاول مرة أخرى.'
        : 'تعذر تنفيذ الطلب. راجع البيانات المدخلة.';
      errorDetail = errMsg;
    }
    const err = new Error(errMsg) as ApiError;
    err.status = response.status;
    err.errorCode = errorCode;
    err.errorDetail = errorDetail;
    throw err;
  }

  return response.json();
}
