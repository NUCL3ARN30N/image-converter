// Image Conversion Web Worker
// Handles heavy image processing off the main thread

self.onmessage = async function(e) {
  const { id, type, data } = e.data;

  try {
    switch (type) {
      case 'convert':
        await convertImage(id, data);
        break;
      case 'decode-heic':
        await decodeHEIC(id, data);
        break;
      default:
        self.postMessage({ id, type: 'error', error: 'Unknown task type' });
    }
  } catch (err) {
    self.postMessage({ id, type: 'error', error: err.message });
  }
};

async function convertImage(id, { imageData, width, height, outputFormat, quality }) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imgData = new ImageData(new Uint8ClampedArray(imageData), width, height);
  ctx.putImageData(imgData, 0, 0);

  let mimeType = 'image/png';
  let q = quality / 100;

  switch (outputFormat) {
    case 'jpg':
    case 'jpeg':
      mimeType = 'image/jpeg';
      break;
    case 'webp':
      mimeType = 'image/webp';
      break;
    case 'png':
      mimeType = 'image/png';
      break;
    default:
      mimeType = 'image/png';
  }

  const blob = await canvas.convertToBlob({ type: mimeType, quality: q });
  const arrayBuffer = await blob.arrayBuffer();

  self.postMessage(
    { id, type: 'converted', blob: arrayBuffer, mimeType, size: arrayBuffer.byteLength },
    [arrayBuffer]
  );
}

async function decodeHEIC(id, { buffer }) {
  // This is handled on main thread with heic2any lib
  self.postMessage({ id, type: 'error', error: 'HEIC decoding must use main thread' });
}
