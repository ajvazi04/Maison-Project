export const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : "");

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Serveri nuk po përgjigjet. Provo përsëri më vonë.");
  }

  const text = await response.text();
  let result = null;
  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      result = { message: text };
    }
  }
  if (!response.ok) {
    const message = result?.errors
      ? Object.values(result.errors).flat().join(" ")
      : result?.message ||
        result?.title ||
        `Gabim nga serveri (${response.status}).`;
    throw new Error(message);
  }
  return result;
}

export const getProductReviews = (id, signal) =>
  request(`/api/products/${id}/reviews`, { signal });

export const submitProductReview = (id, review) =>
  request(`/api/products/${id}/reviews`, {
    method: "POST",
    body: JSON.stringify(review),
  });

export const submitContactMessage = (message) =>
  request("/api/contact", {
    method: "POST",
    body: JSON.stringify(message),
  });

export async function getCurrentAccount() {
  let response;
  try {
    response = await fetch(`${API_URL}/api/account/me`, {
      credentials: "include",
    });
  } catch {
    throw new Error("Nuk mund të lidhemi me serverin. Provo përsëri.");
  }
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Gabim nga serveri (${response.status}).`);
  return response.json();
}

export async function accountRequest(action, body) {
  let response;
  try {
    response = await fetch(`${API_URL}/api/account/${action}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Nuk mund të lidhemi me serverin. Provo përsëri.");
  }

  const text = await response.text();
  let result = {};
  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      result = { message: text };
    }
  }
  if (!response.ok) {
    const message = result.errors
      ? Object.values(result.errors).flat().join(" ")
      : result.message || `Gabim nga serveri (${response.status}).`;
    throw new Error(message);
  }
  return result;
}
