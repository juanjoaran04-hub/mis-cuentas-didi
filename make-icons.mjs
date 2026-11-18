// Genera iconos PNG simples (círculo blanco sobre verde). Se corre una sola vez.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
function png(s) {
  const raw = Buffer.alloc((s * 3 + 1) * s)
  for (let y = 0; y < s; y++) { raw[y * (s * 3 + 1)] = 0
    for (let x = 0; x < s; x++) { const d = Math.hypot(x - s / 2, y - s / 2); const o = y * (s * 3 + 1) + 1 + x * 3
      const col = d < s * 0.3 ? [255, 255, 255] : [22, 163, 74]; raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2] } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(s, 0); ih.writeUInt32BE(s, 4); ih[8] = 8; ih[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
writeFileSync('public/icon-192.png', png(192)); writeFileSync('public/icon-512.png', png(512))
