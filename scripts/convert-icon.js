const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputPath = 'C:\\Users\\li\\Desktop\\微信图片_20260403120225_112_2.jpg';
const outputPath = path.join(__dirname, '..', 'assets', 'icon.ico');

const SIZE = 256;

async function main() {
  // Resize to 256x256 RGBA
  const { data, info } = await sharp(inputPath)
    .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const pixelArraySize = rowSize * height;
  const headerSize = 40;
  const maskSize = Math.ceil(width / 8) * height;
  const dibSize = headerSize + pixelArraySize + maskSize;

  const icoHeaderSize = 6;
  const icoEntrySize = 16;
  const totalSize = icoHeaderSize + icoEntrySize + dibSize;
  const output = Buffer.alloc(totalSize);

  let offset = 0;

  // ICO header
  output.writeUInt16LE(0, offset); offset += 2; // reserved
  output.writeUInt16LE(1, offset); offset += 2; // type: icon
  output.writeUInt16LE(1, offset); offset += 2; // count

  // ICO entry
  output.writeUInt8(0, offset++); // width (0 = 256)
  output.writeUInt8(0, offset++); // height (0 = 256)
  output.writeUInt8(0, offset++); // palette
  output.writeUInt8(0, offset++); // reserved
  output.writeUInt16LE(1, offset); offset += 2; // color planes
  output.writeUInt16LE(32, offset); offset += 2; // bits per pixel
  output.writeUInt32LE(dibSize, offset); offset += 4; // data size
  output.writeUInt32LE(icoHeaderSize + icoEntrySize, offset); offset += 4; // data offset

  // BMP info header
  output.writeUInt32LE(headerSize, offset); offset += 4;
  output.writeInt32LE(width, offset); offset += 4;
  output.writeInt32LE(height * 2, offset); offset += 4; // doubled for ICO
  output.writeUInt16LE(1, offset); offset += 2;
  output.writeUInt16LE(32, offset); offset += 2;
  output.writeUInt32LE(0, offset); offset += 4;
  output.writeUInt32LE(pixelArraySize, offset); offset += 4;
  output.writeInt32LE(2835, offset); offset += 4;
  output.writeInt32LE(2835, offset); offset += 4;
  output.writeUInt32LE(0, offset); offset += 4;
  output.writeUInt32LE(0, offset); offset += 4;

  // BMP pixel data (bottom-up, BGRA)
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const srcOffset = (y * rowSize) + (x * bytesPerPixel);
      const dstOffset = offset + ((height - 1 - y) * rowSize) + (x * 4);
      output[dstOffset] = data[srcOffset + 2];     // B <- R
      output[dstOffset + 1] = data[srcOffset + 1]; // G
      output[dstOffset + 2] = data[srcOffset];     // R <- B
      output[dstOffset + 3] = data[srcOffset + 3]; // A
    }
  }

  fs.writeFileSync(outputPath, output);
  console.log('Icon saved to:', outputPath);
}

main().catch(e => { console.error(e); process.exit(1); });
