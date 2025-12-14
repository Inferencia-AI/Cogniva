import mammoth from 'mammoth';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

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
  markdown: string;
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
// Parse PDF to Markdown
// -----------------------------------------------------------------------------

async function parsePdfToMarkdown(buffer: Buffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      if (pageText.trim()) {
        textParts.push(pageText.trim());
      }
    }

    // Format as markdown with page breaks
    return textParts.join('\n\n---\n\n');
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file');
  }
}

// -----------------------------------------------------------------------------
// Parse DOCX to Markdown
// -----------------------------------------------------------------------------

async function parseDocxToMarkdown(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value;

    // Convert HTML to Markdown using Turndown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    // Add rules for better conversion
    turndownService.addRule('strikethrough', {
      filter: ['del', 's'],
      replacement: (content) => `~~${content}~~`,
    });

    return turndownService.turndown(html);
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    throw new Error('Failed to parse DOCX file');
  }
}

// -----------------------------------------------------------------------------
// Parse RTF to Markdown (basic support)
// -----------------------------------------------------------------------------

async function parseRtfToMarkdown(buffer: Buffer): Promise<string> {
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

    return text;
  } catch (error) {
    console.error('Error parsing RTF:', error);
    throw new Error('Failed to parse RTF file');
  }
}

// -----------------------------------------------------------------------------
// Parse Markdown (just return as-is with minimal cleaning)
// -----------------------------------------------------------------------------

async function parseMarkdownToMarkdown(buffer: Buffer): Promise<string> {
  return buffer.toString('utf-8').trim();
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
  let markdown: string;

  switch (extension) {
    case '.pdf':
      markdown = await parsePdfToMarkdown(buffer);
      break;
    case '.docx':
      markdown = await parseDocxToMarkdown(buffer);
      break;
    case '.rtf':
      markdown = await parseRtfToMarkdown(buffer);
      break;
    case '.md':
      markdown = await parseMarkdownToMarkdown(buffer);
      break;
    default:
      throw new Error(`Unsupported file extension: ${extension}`);
  }

  return {
    title: getTitleFromFileName(fileName),
    markdown,
    originalFileName: fileName,
    fileSize: buffer.length,
    mimeType,
  };
}
