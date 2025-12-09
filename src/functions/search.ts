import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";

const tool = new DuckDuckGoSearch({ maxResults: 1 });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function search(query="hi" as any): Promise<any> {
	const maxAttempts = 3;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const searchResults = await tool.invoke(query);
      query?.searchParams.delete("ss_mkt");  // remove the parameter
			return searchResults;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const isRateLimited = message.toLowerCase().includes("anomaly") || message.toLowerCase().includes("too quickly");
			const shouldRetry = isRateLimited && attempt < maxAttempts;

			if (!shouldRetry) {
				throw error;
			}

			const backoffMs = attempt * 500 + Math.floor(Math.random() * 200);
			await sleep(backoffMs);
      
		}
	}

	throw new Error("DuckDuckGo search failed after retries");
}