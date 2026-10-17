import DOMPurify from 'dompurify';

/**
 * Rich text from a record (tournament notes) is HTML by design, so it cannot be escaped — but it
 * arrives from CFS, other clients, integrators and imported files, so it is sanitized before it is
 * rendered: scripts, event-handler attributes and javascript: URLs are removed, formatting stays.
 */
export function sanitizeHtml(html: unknown): string {
  return typeof html === 'string' ? DOMPurify.sanitize(html) : '';
}
