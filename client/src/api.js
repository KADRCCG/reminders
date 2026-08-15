const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

function getToken() {
  return localStorage.getItem('token');
}

function connectionErrorMessage() {
  if (import.meta.env.DEV) {
    if (API_BASE.startsWith('http')) {
      return `Cannot reach the API at ${API_BASE}. Is the backend running?`;
    }
    return 'Cannot reach the API. Start the server locally or set VITE_API_URL in client/.env.local.';
  }

  if (!import.meta.env.VITE_API_URL) {
    return 'This app is not fully configured yet. Ask your administrator to finish setup and redeploy.';
  }

  return "We couldn't connect to the server. Wait a minute and try again — it may still be starting up. If sign-in keeps failing, contact your administrator.";
}

function httpErrorMessage(status, serverMessage) {
  if (status >= 502 && status <= 504) {
    return 'The server is temporarily unavailable. Please try again in a minute.';
  }
  if (status === 401 || status === 403) {
    return serverMessage || 'Sign-in failed. Check your email and password.';
  }
  return serverMessage || 'Something went wrong. Please try again.';
}

export async function api(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body:
        options.body && !(options.body instanceof FormData)
          ? JSON.stringify(options.body)
          : options.body,
    });
  } catch {
    throw new Error(connectionErrorMessage());
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(httpErrorMessage(res.status, data.message));
  }
  return data;
}
