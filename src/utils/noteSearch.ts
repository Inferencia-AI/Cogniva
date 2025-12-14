import { semanticSearch, type SearchResult } from 'query-sense';
import { sql } from './neon.js';

// =============================================================================
// Note Search Types
// =============================================================================

export interface Note {
  id: number;
  user_id: string;
  title: string;
  body: string;
}

export interface NoteSearchResult {
  note: Note;
  similarity: number;
  matchedContent: string;
}

// =============================================================================
// Note Search Functions
// =============================================================================

/**
 * Search user's notes for content relevant to the query
 * @param userId - The user's ID
 * @param query - The search query
 * @param options - Search options (topK, threshold)
 * @returns Array of matching notes with similarity scores
 */
export async function searchUserNotes(
  userId: string,
  query: string,
  options: { topK?: number; threshold?: number } = {}
): Promise<NoteSearchResult[]> {
  const { topK = 3, threshold = 0.5 } = options;

  // Fetch user's notes from database
  const notes = await sql`SELECT * FROM notes WHERE user_id = ${userId}` as Note[];
  
  if (!notes.length) {
    return [];
  }

  // Prepare note contents for semantic search (combine title and body)
  const noteContents = notes.map(note => 
    `${note.title}\n${note.body || ''}`
  );

  // Perform semantic search
  const searchResponse = await semanticSearch(query, noteContents, {
    topK,
    threshold,
  });

  // Map search results back to notes using document matching
  const matchedNotes: NoteSearchResult[] = searchResponse.results.map((result: SearchResult) => {
    const noteIndex = noteContents.findIndex(content => content === result.document);
    return {
      note: notes[noteIndex],
      similarity: result.score,
      matchedContent: result.document,
    };
  }).filter(item => item.note !== undefined);

  return matchedNotes;
}

/**
 * Format note search results into a response format suitable for the chat
 * @param results - Note search results
 * @returns Formatted response object
 */
export function formatNoteSearchResponse(results: NoteSearchResult[]) {
  if (!results.length) {
    return null;
  }

  return results.map(result => ({
    noteId: result.note.id,
    title: result.note.title,
    body: result.note.body,
    similarity: result.similarity,
  }));
}
