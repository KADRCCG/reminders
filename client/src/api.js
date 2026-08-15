const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

function getToken() {
  return localStorage.getItem('token');
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
    const hint = API_BASE.startsWith('http')
      ? `Cannot reach API at ${API_BASE}. Check Render is live, VITE_API_URL on Vercel, and CLIENT_URL on Render.`
      : 'API URL is not set. On Vercel add VITE_API_URL=https://your-api.onrender.com/api and redeploy.';
    throw new Error(hint);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}
