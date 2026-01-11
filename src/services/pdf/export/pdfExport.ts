/**
 * PDF Export utilities using pdfMake
 * Ported from TMX-Suite-Legacy
 * 
 * Provides functions to open, save, or emit PDFs from docDefinitions
 */

import type { TDocumentDefinitions } from 'pdfmake/interfaces';

// Types for pdfMake (imported dynamically)
interface PdfMakeStatic {
  createPdf(documentDefinitions: TDocumentDefinitions): PdfDocument;
  vfs: any;
}

interface PdfDocument {
  open(): void;
  download(filename?: string): void;
  getBase64(callback: (result: string) => void): void;
  getBlob(callback: (result: Blob) => void): void;
}

/**
 * Dynamically import pdfMake to avoid bloating main bundle
 * @returns Promise resolving to pdfMake instance
 */
async function loadPdfMake(): Promise<PdfMakeStatic> {
  // Dynamic import for code splitting
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
  
  // Get the default exports
  const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;
  const pdfFonts = (pdfFontsModule as any).default || pdfFontsModule;
  
  // Assign fonts
  if (pdfMake && pdfFonts) {
    pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs;
  }
  
  return pdfMake;
}

/**
 * Open PDF in new browser tab/window
 * @param docDefinition - pdfMake document definition
 */
export async function openPDF({ 
  docDefinition 
}: { 
  docDefinition: TDocumentDefinitions 
}): Promise<void> {
  const pdfMake = await loadPdfMake();
  pdfMake.createPdf(docDefinition).open();
}

/**
 * Download PDF file to user's computer
 * @param docDefinition - pdfMake document definition
 * @param filename - Output filename (default: 'document.pdf')
 */
export async function savePDF({ 
  docDefinition, 
  filename = 'document.pdf' 
}: { 
  docDefinition: TDocumentDefinitions;
  filename?: string;
}): Promise<void> {
  const pdfMake = await loadPdfMake();
  pdfMake.createPdf(docDefinition).download(filename);
}

/**
 * Get PDF as base64 string (useful for sending to server)
 * @param docDefinition - pdfMake document definition
 * @returns Promise resolving to base64 string
 */
export async function getPDFBase64({ 
  docDefinition 
}: { 
  docDefinition: TDocumentDefinitions 
}): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const pdfMake = await loadPdfMake();
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      pdfDocGenerator.getBase64((data) => {
        resolve(data);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get PDF as Blob (useful for uploading or further processing)
 * @param docDefinition - pdfMake document definition
 * @returns Promise resolving to Blob
 */
export async function getPDFBlob({ 
  docDefinition 
}: { 
  docDefinition: TDocumentDefinitions 
}): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const pdfMake = await loadPdfMake();
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      pdfDocGenerator.getBlob((blob) => {
        resolve(blob);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Emit PDF to server or callback
 * @param docDefinition - pdfMake document definition
 * @param callback - Function to call with base64 data
 */
export async function emitPDF({ 
  docDefinition, 
  callback 
}: { 
  docDefinition: TDocumentDefinitions;
  callback: (data: string) => void;
}): Promise<void> {
  const base64 = await getPDFBase64({ docDefinition });
  callback(base64);
}
