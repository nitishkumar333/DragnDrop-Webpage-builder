/**
 * URL for a backend API route, e.g. apiUrl("/getFunnel/getAll").
 *
 * The API is served by the FastAPI backend (backend/). In the browser, requests
 * go to this app's own /api path, which next.config.mjs rewrites to the
 * backend. On the server, call the backend directly.
 */
export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export const apiUrl = (path: string) =>
  `${typeof window === "undefined" ? BACKEND_URL : ""}/api${path}`;
