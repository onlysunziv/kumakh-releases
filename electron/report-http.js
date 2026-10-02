function safeEndpoint(value) {
  try {
    const url = new URL(String(value || ""));
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return `${url.origin}${url.pathname}`;
  } catch (_) {
    return String(value || "unknown endpoint").split(/[?#]/, 1)[0].slice(0, 240);
  }
}

function responseSummary(raw, contentType) {
  const text = String(raw || "").trim();
  if (!text) return "The response body was empty.";
  if (/window\s*\[\s*['"]ppConfig['"]\s*\]/i.test(text)) {
    return "Google returned an HTML error page beginning with window['ppConfig'], not the Apps Script JSON API response. Verify the saved deployment URL and that it is the deployed /exec URL.";
  }
  if (/text\/html/i.test(String(contentType || "")) || /<!doctype html|<html\b/i.test(text)) {
    const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return `The endpoint returned an HTML page${title ? ` titled "${title.slice(0, 100)}"` : ""}, not JSON.`;
  }
  return `The endpoint returned a non-JSON ${String(contentType || "unknown content type")} response (${text.length} characters).`;
}

function statusDetail(status) {
  if (status === 404) return "The requested Apps Script endpoint was not found; verify the current deployed /exec URL";
  if (status === 401 || status === 403) return "The endpoint denied access; verify deployment access and report authentication";
  return "";
}

function nonJsonResponseError(response, endpoint, raw, operation = "report request") {
  const status = Number(response?.status) || 0;
  const contentType = response?.headers?.get?.("content-type") || "unknown";
  const requested = safeEndpoint(endpoint);
  const responded = safeEndpoint(response?.url || endpoint);
  const summary = responseSummary(raw, contentType);
  const statusText = status ? `HTTP ${status}` : "unknown HTTP status";
  const detail = statusDetail(status);
  const error = new Error(
    `Reports ${operation} received a non-JSON response (${statusText})${detail ? `. ${detail}` : ""}. Requested endpoint: ${requested}. Response endpoint: ${responded}. Content-Type: ${contentType}. Summary: ${summary}`,
  );
  error.code = `REPORT_HTTP_${status || "UNKNOWN"}`;
  error.status = status;
  error.retryable = [408, 429, 500, 502, 503, 504].includes(status);
  error.endpoint = requested;
  return error;
}

function httpResponseError(response, endpoint, body, operation = "report request") {
  const status = Number(response?.status) || 0;
  const message = body?.data?.message || body?.message || `HTTP ${status || "unknown"}`;
  const requested = safeEndpoint(endpoint);
  const responded = safeEndpoint(response?.url || endpoint);
  const detail = statusDetail(status);
  const error = new Error(
    `Reports ${operation} failed with HTTP ${status || "unknown"} (${message})${detail ? `. ${detail}` : ""}. Requested endpoint: ${requested}. Response endpoint: ${responded}.`,
  );
  error.code = `REPORT_HTTP_${status || "UNKNOWN"}`;
  error.status = status;
  error.retryable = [408, 429, 500, 502, 503, 504].includes(status);
  error.endpoint = requested;
  return error;
}

async function readJsonResponse(response, endpoint, operation) {
  const raw = typeof response.text === "function" ? await response.text() : null;
  if (raw === null) {
    try {
      return await response.json();
    } catch (_) {
      throw nonJsonResponseError(response, endpoint, "", operation);
    }
  }
  try {
    return JSON.parse(raw);
  } catch (_) {
    throw nonJsonResponseError(response, endpoint, raw, operation);
  }
}

module.exports = {
  httpResponseError,
  nonJsonResponseError,
  readJsonResponse,
  responseSummary,
  safeEndpoint,
};
