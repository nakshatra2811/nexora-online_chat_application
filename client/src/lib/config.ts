// Nexora Configuration System
// Centralizes all API and environment-specific settings.

export const API_BASE_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000')
  : 'http://localhost:5000';

export const SOCKET_URL = API_BASE_URL;

export const APP_NAME = "Nexora";
export const BRAND_TAGLINE = "The Privacy Protocol";
export const APP_LOGO = "https://res.cloudinary.com/dzpci7b5j/image/upload/v1774956459/logo_zsgzf2.svg";

/**
 * Enhanced fetch wrapper with error handling for Nexora services.
 */
export async function nexoraFetch(endpoint: string, options: RequestInit = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      cache: 'no-store',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const contentType = response.headers.get("content-type");
    let data;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      // Handle non-JSON response (e.g., HTML error page from proxy/Next.js)
      const text = await response.text();
      console.warn(`[Nexora Protocol] Non-JSON payload from ${endpoint}:`, text.slice(0, 50) + "...");
      data = { error: "Non-JSON response received", status: response.status, _isHtml: true };
    }
    
    if (!response.ok) {
      // Return the error body with a flag so callers can check
      return { ...data, _httpError: true, _status: response.status };
    }
    
    return data;
  } catch (err) {
    // Graceful failure for "Failed to fetch" (unreachable server)
    console.error(`[Nexora Protocol] Connectivity failed for ${endpoint}:`, err);
    return null;
  }
}
