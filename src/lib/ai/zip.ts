// Minimal zero-dependency ZIP writer (STORE only, no compression).
// Produces a valid .zip that any tool can decompress. Preserves binary bytes.
// Not suitable for very large archives (>4 GB) since it uses 32-bit sizes.

import { deflateRawSync } from "node:zlib";

type ZipEntry = {
  name: string;
  data: Buffer;
  compress: boolean;
};

function toBuffer(input: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === "string") return Buffer.from(input, "utf8");
  return Buffer.from(input);
}

function crc32(buf: Buffer): number {
  let table = (crc32 as any)._table as number[] | undefined;
  if (!table) {
    table = new Array<number>(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    (crc32 as any)._table = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = (table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

export class ZipBuilder {
  private entries: ZipEntry[] = [];

  add(name: string, data: Buffer | Uint8Array | string, options: { compress?: boolean } = {}) {
    const buf = toBuffer(data);
    this.entries.push({ name, data: buf, compress: options.compress ?? true });
    return this;
  }

  build(): Buffer {
    const localChunks: Buffer[] = [];
    const centralChunks: Buffer[] = [];
    let offset = 0;
    const { time, day } = dosDateTime();

    for (const entry of this.entries) {
      const nameBuf = Buffer.from(entry.name, "utf8");
      const crc = crc32(entry.data);
      const uncompressedSize = entry.data.length;
      let payload = entry.data;
      let method = 0;
      if (entry.compress && uncompressedSize > 0) {
        const deflated = deflateRawSync(entry.data);
        if (deflated.length < uncompressedSize) {
          payload = deflated;
          method = 8;
        }
      }
      const compressedSize = payload.length;

      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0x0800, 6);
      localHeader.writeUInt16LE(method, 8);
      localHeader.writeUInt16LE(time, 10);
      localHeader.writeUInt16LE(day, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(compressedSize, 18);
      localHeader.writeUInt32LE(uncompressedSize, 22);
      localHeader.writeUInt16LE(nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);

      const localEntry = Buffer.concat([localHeader, nameBuf, payload]);
      localChunks.push(localEntry);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0x0800, 8);
      centralHeader.writeUInt16LE(method, 10);
      centralHeader.writeUInt16LE(time, 12);
      centralHeader.writeUInt16LE(day, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(compressedSize, 20);
      centralHeader.writeUInt32LE(uncompressedSize, 24);
      centralHeader.writeUInt16LE(nameBuf.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);
      centralChunks.push(Buffer.concat([centralHeader, nameBuf]));

      offset += localEntry.length;
    }

    const centralDirectory = Buffer.concat(centralChunks);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(this.entries.length, 8);
    eocd.writeUInt16LE(this.entries.length, 10);
    eocd.writeUInt32LE(centralDirectory.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localChunks, centralDirectory, eocd]);
  }
}

export function buildZip(entries: Array<{ name: string; data: Buffer | Uint8Array | string; compress?: boolean }>): Buffer {
  const zip = new ZipBuilder();
  for (const entry of entries) zip.add(entry.name, entry.data, { compress: entry.compress });
  return zip.build();
}
