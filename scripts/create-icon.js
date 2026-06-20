const fs = require('fs');
const path = require('path');

const width = 256;
const height = 256;
const bytesPerPixel = 4;
const rowSize = width * bytesPerPixel;
const pixelArraySize = rowSize * height;
const headerSize = 40;
const fileHeaderSize = 14;
const maskSize = (width / 8) * height;
const dibSize = headerSize + pixelArraySize + maskSize;
const icoHeaderSize = 6;
const icoEntrySize = 16;
const totalSize = icoHeaderSize + icoEntrySize + dibSize;

const output = Buffer.alloc(totalSize);
let offset = 0;

output.writeUInt16LE(0, offset); offset += 2;
output.writeUInt16LE(1, offset); offset += 2;
output.writeUInt16LE(1, offset); offset += 2;

output.writeUInt8(0, offset++);
output.writeUInt8(0, offset++);
output.writeUInt8(0, offset++);
output.writeUInt8(0, offset++);
output.writeUInt16LE(1, offset); offset += 2;
output.writeUInt16LE(32, offset); offset += 2;
output.writeUInt32LE(dibSize, offset); offset += 4;
output.writeUInt32LE(icoHeaderSize + icoEntrySize, offset); offset += 4;

output.writeUInt32LE(headerSize, offset); offset += 4;
output.writeInt32LE(width, offset); offset += 4;
output.writeInt32LE(height * 2, offset); offset += 4;
output.writeUInt16LE(1, offset); offset += 2;
output.writeUInt16LE(32, offset); offset += 2;
output.writeUInt32LE(0, offset); offset += 4;
output.writeUInt32LE(pixelArraySize, offset); offset += 4;
output.writeInt32LE(2835, offset); offset += 4;
output.writeInt32LE(2835, offset); offset += 4;
output.writeUInt32LE(0, offset); offset += 4;
output.writeUInt32LE(0, offset); offset += 4;

const centerX = width / 2;
const centerY = height / 2;
const radius = 56;
const innerRadius = 34;

for (let y = height - 1; y >= 0; y--) {
  for (let x = 0; x < width; x++) {
    const pixelOffset = offset + ((height - 1 - y) * rowSize) + (x * 4);
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const inRing = distance <= radius && distance >= innerRadius;
    const inCore = x > 66 && x < 190 && y > 88 && y < 168;
    const soft = Math.max(0, 1 - distance / 180);

    let r = 18;
    let g = 23;
    let b = 31;
    let a = 0;

    if (inRing || inCore) {
      r = 255;
      g = 107 - Math.floor(distance % 20);
      b = 87;
      a = 255;
    } else if (distance < 118) {
      r = 40;
      g = 48;
      b = 62;
      a = Math.floor(220 * soft);
    }

    output[pixelOffset] = b;
    output[pixelOffset + 1] = g;
    output[pixelOffset + 2] = r;
    output[pixelOffset + 3] = a;
  }
}

offset += pixelArraySize + maskSize;

const destination = path.join(__dirname, '..', 'assets', 'icon.ico');
fs.writeFileSync(destination, output);
console.log(destination);
