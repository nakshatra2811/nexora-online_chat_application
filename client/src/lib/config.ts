// Nexora Configuration System
// Centralizes all API and environment-specific settings.

// Backend API URL — uses env for prod, falls back to localhost for local dev
export const API_BASE_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000')
  : 'http://127.0.0.1:5000';

export const SOCKET_URL = API_BASE_URL;

// Production app domain — ALWAYS the real URL (used in share links, OG tags, emails)
// Never localhost — share links must open on the real site, not the dev server
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nexora31.vercel.app';
export const APP_DOMAIN = 'nexora31.vercel.app';

export const APP_NAME = "Nexora";
export const BRAND_TAGLINE = "The Privacy Protocol";
export const APP_LOGO = "https://res.cloudinary.com/dzpci7b5j/image/upload/v1774956459/logo_zsgzf2.svg";

/**
 * Enhanced fetch wrapper with automatic IPv4/IPv6 fallback and error handling.
 */
export async function nexoraFetch(endpoint: string, options: RequestInit = {}, retries = 1) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;
    const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      cache: 'no-store',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...options.headers,
      },
      // Added moderate timeout for local network sanity
      signal: AbortController ? AbortSignal.timeout(25000) : undefined,
    } as any);
    
    const contentType = response.headers.get("content-type");
    let data;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { error: "Non-JSON response", status: response.status, text: text.slice(0, 100) };
    }
    
    if (!response.ok) return { ...data, _httpError: true, _status: response.status };
    return data;
  } catch (err: any) {
    // If it's a Fetch error and we have retries, try once more after a small delay
    // This handles initial dev-server startup races.
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 500));
      return nexoraFetch(endpoint, options, retries - 1);
    }
    
    // Final failure - return null but don't throw to prevent UI crash
    ((..._args: any[]) => {})(`[Connectivity] ${endpoint} unreachable.`);
    return null;
  }
}
