import axios from "axios";
import { load } from "cheerio";

export async function search(query: string) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const { data: html } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  const $ = load(html);
  const links: string[] = [];

  $("a.result__a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      try {
        const urlObj = new URL(href.startsWith("//") ? "https:" + href : href);
        const uddg = urlObj.searchParams.get("uddg");
        if (uddg) links.push(decodeURIComponent(uddg));
      } catch {}
    }
  });

  // return links;
  if (links.length === 0) {
    return [`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`]
  }
  return links
}


