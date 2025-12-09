import tvly from "../utils/tavily.js";

export async function search(query: string): Promise<any> {
  const response = await tvly.search(query, {includeAnswer:true, includeImages: true});

  return {
    links: response?.results?.map((item: any) => (item?.url)),
    answer:response?.answer,
    images:response?.images,
  }
}