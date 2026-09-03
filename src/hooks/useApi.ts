import { useAuth } from '../context/AuthContext';

export function useApi() {
  const { getIdToken } = useAuth();

  const authenticatedFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getIdToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const rawText = await response.text();
      if (!response.ok) {
        throw new Error(`Server returned error (${response.status}): ${rawText.slice(0, 100)}`);
      }
      throw new Error(`Unexpected non-JSON response from server (${response.status})`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || `Request failed with status ${response.status}`);
    }

    return data;
  };

  return { authenticatedFetch };
}
