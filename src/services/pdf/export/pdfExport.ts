/**
 * PDF Export utilities using pdf-factory (jsPDF)
 *
 * Provides functions to open, save, or get PDF data from jsPDF documents.
 */

import type jsPDF from 'jspdf';

/**
 * Open PDF in new browser tab/window
 */
export function openPDF({ doc }: { doc: jsPDF }): void {
  const blob = doc.output('blob');
  window.open(URL.createObjectURL(blob));
}

/**
 * Download PDF file to user's computer
 */
export function savePDF({ doc, filename = 'document.pdf' }: { doc: jsPDF; filename?: string }): void {
  doc.save(filename);
}

/**
 * Get PDF as base64 string (useful for sending to server)
 */
export function getPDFBase64({ doc }: { doc: jsPDF }): string {
  return doc.output('datauristring');
}

/**
 * Get PDF as Blob (useful for uploading or further processing)
 */
export function getPDFBlob({ doc }: { doc: jsPDF }): Blob {
  return doc.output('blob');
}
