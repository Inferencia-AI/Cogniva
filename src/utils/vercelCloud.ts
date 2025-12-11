import { put } from "@vercel/blob";

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('Missing required env var BLOB_READ_WRITE_TOKEN');
  process.exit(1);
}

function decodeBase64DataUri(dataUri:any) {
  const [meta, base64Data] = dataUri.split(',');
  const match = meta.match(/^data:(.*);base64$/);
  const mimeType = match ? match[1] : 'application/octet-stream';
  const buffer = Buffer.from(base64Data, 'base64');
  return { buffer, mimeType };
}


export function uploadBase64Image(dataUri:any, fileName:any) {
  const { buffer, mimeType } = decodeBase64DataUri(dataUri);
  return put(fileName, buffer, {
    access: 'public',
    contentType: mimeType,
  });
}
