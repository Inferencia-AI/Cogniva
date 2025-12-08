import { load } from "cheerio";

export async function search(query: string): Promise<string[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const html = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"
    }
  }).then(r => r.text());

  const $ = load(html);
  const links: string[] = [];

  const sanitizeUrl = (rawUrl: string): string | null => {
    let cleaned = rawUrl.trim();
    if (!cleaned) return null;

    // DuckDuckGo sometimes appends tracking-like segments (e.g., &rut=...) without a '?'.
    const rutIndex = cleaned.indexOf("&rut=");
    if (rutIndex !== -1 && cleaned.indexOf("?") === -1) {
      cleaned = cleaned.slice(0, rutIndex);
    }

    // If there are stray '&' segments without a preceding '?', drop everything after the first '&'.
    if (!cleaned.includes("?") && cleaned.includes("&")) {
      cleaned = cleaned.split("&")[0];
    }

    try {
      const parsed = new URL(cleaned);
      if (!/^https?:$/.test(parsed.protocol)) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  };

  $(".result__title a").each((_, el) => {
    const raw = $(el).attr("href");
    if (!raw) return;

    // DuckDuckGo returns a redirect link like "/l/?kh=-1&uddg=<encoded>"
    const match = raw.match(/uddg=(.*)$/);
    const decoded = match ? decodeURIComponent(match[1]) : raw;
    const cleanUrl = sanitizeUrl(decoded);

    if (cleanUrl) {
      links.push(cleanUrl);
    }
  });

  return Array.from(new Set(links)).slice(0, 5);
}
