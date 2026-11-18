// Genera los iconos PNG de la app (fondo oscuro, círculo turquesa con 3 barras que suben). Se corre a mano: node make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let r = 0xffffffff; for (const x of b) r = crcTable[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }

const BG = [14, 17, 22], TEAL = [45, 212, 191], DARK = [4, 32, 28]
// Colores en coordenadas 0..1 (la figura queda dentro del 70% central: segura para iconos "maskable")
function pixel(u, v) {
  if (Math.hypot(u - 0.5, v - 0.5) > 0.33) return BG
  const barras = [[0.36, 0.56], [0.48, 0.44], [0.60, 0.32]] // [x, y de arriba]; todas terminan en y=0.66
  for (const [x, top] of barras) if (u >= x - 0.04 && u <= x + 0.04 && v >= top && v <= 0.66) return DARK
  return TEAL
}
function png(s) {
  const raw = Buffer.alloc((s * 3 + 1) * s)
  const SS = 3
  for (let y = 0; y < s; y++) {
    raw[y * (s * 3 + 1)] = 0
    for (let x = 0; x < s; x++) {
      let r = 0, g = 0, b = 0
      for (let i = 0; i < SS; i++) for (let j = 0; j < SS; j++) { const p = pixel((x + (i + 0.5) / SS) / s, (y + (j + 0.5) / SS) / s); r += p[0]; g += p[1]; b += p[2] }
      const o = y * (s * 3 + 1) + 1 + x * 3
      raw[o] = Math.round(r / SS ** 2); raw[o + 1] = Math.round(g / SS ** 2); raw[o + 2] = Math.round(b / SS ** 2)
    }
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(s, 0); ih.writeUInt32BE(s, 4); ih[8] = 8; ih[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
writeFileSync('public/icon-192.png', png(192))
writeFileSync('public/icon-512.png', png(512))
