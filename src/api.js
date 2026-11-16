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
    throw new Error("The server is not responding. Please try again later.");
  }

  const text = await response.text();
  let result = null;
  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      // Non-JSON responses (such as a hosting provider's HTML 404 page)
      // must not be surfaced as user-facing API errors.
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
    throw new Error("Unable to connect to the server. Please try again.");
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
    throw new Error("Unable to connect to the server. Please try again.");
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
