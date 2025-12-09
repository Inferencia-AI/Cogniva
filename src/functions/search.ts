import axios from "axios";
import { load } from "cheerio";

type InstantAnswer = {
  abstract?: string;
  source?: string;
  heading?: string;
  url?: string;
  image?: string;
  answerType?: string;
  entity?: string;
  relatedTopics?: string[];
};

export async function search(query: string) {
  const encodedQuery = encodeURIComponent(query);
  const htmlUrl = `https://duckduckgo.com/html/?q=${encodedQuery}`;
  const instantUrl = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_redirect=1&no_html=1`;

  const [instantData, htmlData] = await Promise.all([
    axios.get(instantUrl).then((res) => res.data).catch(() => ({})),
    axios
      .get(htmlUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      })
      .then((res) => res.data)
      .catch(() => "")
  ]);

  const linksFromInstant: string[] = [];
  if (Array.isArray(instantData.Results)) {
    for (const result of instantData.Results) {
      if (result?.FirstURL) linksFromInstant.push(result.FirstURL);
    }
  }

  if (Array.isArray(instantData.RelatedTopics)) {
    for (const topic of instantData.RelatedTopics) {
      if (topic?.FirstURL) linksFromInstant.push(topic.FirstURL);
    }
  }

  const instantAnswer: InstantAnswer = {
    abstract: instantData.Abstract || instantData.AbstractText,
    source: instantData.AbstractSource,
    heading: instantData.Heading,
    url: instantData.AbstractURL || instantData.OfficialWebsite || instantData.OfficialDomain,
    image: instantData.Image ? `https://duckduckgo.com${instantData.Image}` : undefined,
    answerType: instantData.AnswerType || instantData.Type,
    entity: instantData.Entity,
    relatedTopics: Array.isArray(instantData.RelatedTopics)
      ? instantData.RelatedTopics
        .map((topic: { Text?: string }) => topic?.Text)
        .filter((text?: string): text is string => Boolean(text))
      : undefined
  };

  const $ = load(htmlData);
  const linksFromHtml: string[] = [];

  $("a.result__a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      try {
        const urlObj = new URL(href.startsWith("//") ? "https:" + href : href);
        const uddg = urlObj.searchParams.get("uddg");
        if (uddg) linksFromHtml.push(decodeURIComponent(uddg));
      } catch {}
    }
  });

  const links = Array.from(new Set([...linksFromInstant, ...linksFromHtml]));

  if (links.length === 0) {
    return { links: [htmlUrl], instantAnswer };
  }

  return { links, instantAnswer };
}


