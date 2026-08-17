export async function fetchWithRetry(url, options = {}, retries = 3, backoff = 500) {
  try {
    const response = await fetch(url, options);
    // Retry on network errors or 5xx server errors
    if (!response.ok && retries > 0 && response.status >= 500) {
      throw new Error(`Server returned error status: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Fetch failed. Retrying in ${backoff}ms... (${retries} retries left). Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}
