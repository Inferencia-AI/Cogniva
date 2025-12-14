import mammoth from 'mammoth';
import { JSDOM } from 'jsdom';
import { extractText } from 'unpdf';
import { marked } from 'marked';

// =============================================================================
// Document Parser - Convert PDF, DOCX, RTF, and MD files to Markdown
// =============================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/rtf',
  'text/rtf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/x-markdown',
  'text/plain', // Sometimes MD files are detected as text/plain
];

const ALLOWED_EXTENSIONS = ['.pdf', '.rtf', '.docx', '.md'];

export interface ParsedDocument {
  title: string;
  html: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
}

export interface DocumentParseError {
  error: string;
  code: 'FILE_TOO_LARGE' | 'UNSUPPORTED_TYPE' | 'PARSE_ERROR';
}

// -----------------------------------------------------------------------------
// Validation helpers
// -----------------------------------------------------------------------------

export function validateFile(
  fileName: string,
  fileSize: number,
  mimeType: string
): DocumentParseError | null {
  if (fileSize > MAX_FILE_SIZE) {
    return {
      error: `File size exceeds 10MB limit. Current size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB`,
      code: 'FILE_TOO_LARGE',
    };
  }

  const extension = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  const isValidExtension = ALLOWED_EXTENSIONS.includes(extension);
  const isValidMimeType = ALLOWED_MIME_TYPES.includes(mimeType);

  if (!isValidExtension && !isValidMimeType) {
    return {
      error: `Unsupported file type. Allowed: PDF, DOCX, RTF, MD`,
      code: 'UNSUPPORTED_TYPE',
    };
  }

  return null;
}

// -----------------------------------------------------------------------------
// Get file extension from filename
// -----------------------------------------------------------------------------

function getFileExtension(fileName: string): string {
  return fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
}

// -----------------------------------------------------------------------------
// Get title from filename (without extension)
// -----------------------------------------------------------------------------

function getTitleFromFileName(fileName: string): string {
  const nameWithoutExt = fileName.slice(0, fileName.lastIndexOf('.'));
  return nameWithoutExt || 'Imported Document';
}

// -----------------------------------------------------------------------------
// Parse PDF to HTML
// -----------------------------------------------------------------------------

async function parsePdfToHtml(buffer: Buffer): Promise<string> {
  try {
    // unpdf requires Uint8Array, not Buffer
    const uint8Array = new Uint8Array(buffer);
    const { text } = await extractText(uint8Array);
    
    // unpdf returns text as string[] (array of pages)
    // Join pages and clean up the text
    const fullText = Array.isArray(text) ? text.join('\n') : text;
    
    // Convert text to HTML paragraphs
    const paragraphs = fullText
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => `<p>${line}</p>`)
      .join('\n');

    return paragraphs || '<p>No text content found in PDF.</p>';
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file');
  }
}

// -----------------------------------------------------------------------------
// Parse DOCX to HTML
// -----------------------------------------------------------------------------

async function parseDocxToHtml(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.convertToHtml({ buffer });
    // mammoth already returns clean HTML, just return it directly
    return result.value;
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    throw new Error('Failed to parse DOCX file');
  }
}

// -----------------------------------------------------------------------------
// Parse RTF to HTML (basic support)
// -----------------------------------------------------------------------------

async function parseRtfToHtml(buffer: Buffer): Promise<string> {
  try {
    const rtfContent = buffer.toString('utf-8');
    
    // Basic RTF to plain text conversion
    // Remove RTF control words and groups
    let text = rtfContent
      // Remove header
      .replace(/^\{\\rtf1[^}]*\}?/g, '')
      // Remove font tables
      .replace(/\{\\fonttbl[^}]*\}/g, '')
      // Remove color tables
      .replace(/\{\\colortbl[^}]*\}/g, '')
      // Remove style sheets
      .replace(/\{\\stylesheet[^}]*\}/g, '')
      // Remove info groups
      .replace(/\{\\info[^}]*\}/g, '')
      // Remove other control groups
      .replace(/\{\\[^}]*\}/g, '')
      // Convert paragraph breaks
      .replace(/\\par\s*/g, '\n\n')
      // Convert line breaks
      .replace(/\\line\s*/g, '\n')
      // Convert tabs
      .replace(/\\tab\s*/g, '\t')
      // Remove remaining control words
      .replace(/\\[a-z]+\d*\s*/gi, '')
      // Remove remaining braces
      .replace(/[{}]/g, '')
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Convert to HTML paragraphs
    const paragraphs = text
      .split('\n\n')
      .filter((p: string) => p.trim().length > 0)
      .map((p: string) => `<p>${p.trim()}</p>`)
      .join('\n');

    return paragraphs;
  } catch (error) {
    console.error('Error parsing RTF:', error);
    throw new Error('Failed to parse RTF file');
  }
}

// -----------------------------------------------------------------------------
// Parse Markdown to HTML
// -----------------------------------------------------------------------------

async function parseMarkdownToHtml(buffer: Buffer): Promise<string> {
  const markdown = buffer.toString('utf-8').trim();
  // Convert markdown to HTML using marked
  return await marked(markdown);
}

// -----------------------------------------------------------------------------
// Main parse function
// -----------------------------------------------------------------------------

export async function parseDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParsedDocument> {
  const extension = getFileExtension(fileName);
  let html: string;

  switch (extension) {
    case '.pdf':
      html = await parsePdfToHtml(buffer);
      break;
    case '.docx':
      html = await parseDocxToHtml(buffer);
      break;
    case '.rtf':
      html = await parseRtfToHtml(buffer);
      break;
    case '.md':
      html = await parseMarkdownToHtml(buffer);
      break;
    default:
      throw new Error(`Unsupported file extension: ${extension}`);
  }

  return {
    title: getTitleFromFileName(fileName),
    html,
    originalFileName: fileName,
    fileSize: buffer.length,
    mimeType,
  };
}
