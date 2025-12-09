// npm i @tavily/core
import { tavily } from "@tavily/core";

const client = tavily({
  apiKey: "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"
});

export async function search(query: string): Promise<string[]> {
  const res = await client.search(query, {
    includeAnswer: "advanced",
    maxResults: 10
  });

  // Tavily returns: { results: [ { url, title, content }, ... ] }
  const links = res.results
    .map(r => r.url)
    .filter(url => typeof url === "string");

  return links;
}


