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

  if (links.length === 0) {
    // Fallback to scraping HTML results if no links found in JSON response
    const htmlUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const htmlRes = await fetch(htmlUrl);
    const html = await htmlRes.text();
    const $ = load(html);

    $('a.result__a').each((_, element) => {
      const link = $(element).attr('href');
      if (link) links.push(link);
    });
  }

  return links
}
