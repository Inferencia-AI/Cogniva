import tvly from "../utils/tavily.ts";

export async function search(query: string): Promise<any> {
  const response = await tvly.search(query);

  return {links: response?.results?.map((item: any) => (item?.url
  ))}
}