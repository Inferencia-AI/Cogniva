const BASE_URL = "https://www.daraz.pk/catalog/";

export async function searchDaraz({
  keyword = "laptops",
  page = 1,
  limit = 10,
}) {
  if (!keyword) {
    throw new Error("keyword is required");
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("q", keyword);
  url.searchParams.set("page", page);
  url.searchParams.set("ajax", "true");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://www.daraz.pk/",
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!res.ok) {
    throw new Error(`Daraz request failed: ${res.status}`);
  }

  const data = await res.json();

  const items = data?.mods?.listItems ?? [];

  return items.slice(0, limit).map(item => ({
    title: item.name,
    price: item.price,
    rating: item.ratingScore,
    image: item.image,
    productUrl: item.productUrl
      ? `https:${item.productUrl}`
      : null,
    seller: item.sellerName,
  }));
}