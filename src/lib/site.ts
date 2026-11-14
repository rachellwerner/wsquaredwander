/** Canonical public origin for W²ander (read "Wander Squared"). */
export const SITE_URL = "https://wsquaredwander.com";

export function canonicalUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}