// Obtain a fresh token from the backend before each state-changing admin request.
async function getCsrfToken() {
  let response;
  try {
    response = await fetch('/admin/csrf', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new Error('Unable to reach the server to obtain a security token.');
  }
  if (!response.ok) {
    const error = new Error(response.status === 401
      ? 'Your admin session has expired.'
      : `Unable to obtain a security token (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The server returned an invalid security token response.'); }
  if (typeof data.csrfToken !== 'string' || !data.csrfToken) {
    throw new Error('The security token is missing from the server response.');
  }
  return data.csrfToken;
}
