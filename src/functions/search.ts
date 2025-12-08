import { load } from "cheerio";

export async function search(query: string): Promise<string[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&skip_disambig=1`;
  const res = await fetch(url);
  const data = await res.json();

  const links: string[] = [];
  if (data.RelatedTopics) {
    data.RelatedTopics.forEach((topic: any) => {
      if (topic.FirstURL) links.push(topic.FirstURL);
    });
  }

  return links.slice(0, 5)
}
