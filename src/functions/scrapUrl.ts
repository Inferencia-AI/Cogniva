import axios from 'axios';
import { load } from 'cheerio';

export async function scrapUrl(url: string): Promise<{
    title: string;
    description: string;
    images: string[];
    links: string[];
    html: string;
    assets: string[];
}> {
    try {
        const { data } = await axios.get(url);
        const $ = load(data);

        const html = $.html();

        const title = $('head > title').text() || 'No title found';
        const description =
            $('meta[name="description"]').attr('content') ||
            'No description found';

        const images: string[] = [];
        const links: string[] = [];
        const assets: string[] = [];

        // Collect unique items helper
        const uniqPush = (arr: string[], item?: string) => {
            if (item && !arr.includes(item)) arr.push(item);
        };

        // Extract <img> src
        $('img').each((_, img) => uniqPush(images, $(img).attr('src')));

        // Extract OG image
        uniqPush(images, $('meta[property="og:image"]').attr('content'));

        // Extract inline CSS background images
        $('[style]').each((_, elem) => {
            const style = $(elem).attr('style');
            const urlMatch = style?.match(/background-image:\s*url\(['"]?(.*?)['"]?\)/);
            uniqPush(images, urlMatch?.[1]);
        });

        // Extract links (<a>)
        $('a[href^="http"]').each((_, link) =>
            uniqPush(links, $(link).attr('href'))
        );

        // Extract assets: CSS + JS + images + anything with src/href
        $('link[href], script[src], img[src]').each((_, el) => {
            const href = $(el).attr('href');
            const src = $(el).attr('src');
            uniqPush(assets, href);
            uniqPush(assets, src);
        });

        // Also extract <video>, <audio>, <source>, <iframe>, etc.
        $('[src], source[srcset]').each((_, el) => {
            uniqPush(assets, $(el).attr('src'));
            uniqPush(assets, $(el).attr('srcset'));
        });

        return {
            title,
            description,
            images,
            links,
            html,
            assets,
        };
    } catch (error: any) {
        throw new Error(`Failed to scrap URL: ${error?.message}`);
    }
}
