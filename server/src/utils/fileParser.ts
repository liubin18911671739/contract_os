/**
 * File parser service - handles TXT, PDF, DOCX parsing
 */
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export interface ParseResult {
  text: string;
  metadata?: {
    pages?: number;
    title?: string;
    author?: string;
  };
}

export class FileParser {
  /**
   * Parse contract file based on MIME type
   */
  async parse(file: Buffer, mime: string, filename: string): Promise<ParseResult> {
    switch (mime) {
      case 'text/plain':
        return this.parseTxt(file);

      case 'application/pdf':
        return this.parsePdf(file);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return this.parseDocx(file, filename);

      default:
        throw new Error(`Unsupported MIME type: ${mime}`);
    }
  }

  /**
   * Parse plain text file
   */
  private parseTxt(file: Buffer): ParseResult {
    const text = file.toString('utf-8');
    return { text };
  }

  /**
   * Parse PDF file
   */
  private async parsePdf(file: Buffer): Promise<ParseResult> {
    try {
      const data = await pdf(file);
      return {
        text: data.text,
        metadata: {
          pages: data.numpages,
        },
      };
    } catch (error) {
      throw new Error(
        `PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse DOCX file
   */
  private async parseDocx(file: Buffer, filename: string): Promise<ParseResult> {
    try {
      const result = await mammoth.extractRawText({ buffer: file });

      if (result.messages && result.messages.length > 0) {
        const warnings = result.messages.filter((m) => m.type === 'warning');
        if (warnings.length > 0) {
          console.warn(`DOCX parsing warnings for ${filename}:`, warnings);
        }
      }

      return {
        text: result.value,
        metadata: {
          title: filename,
        },
      };
    } catch (error) {
      throw new Error(
        `DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get supported MIME types
   */
  getSupportedMimeTypes(): string[] {
    return [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
  }

  /**
   * Check if MIME type is supported
   */
  isSupported(mime: string): boolean {
    return this.getSupportedMimeTypes().includes(mime);
  }
}

export const fileParser = new FileParser();
