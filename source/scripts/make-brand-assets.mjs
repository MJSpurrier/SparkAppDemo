import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "resources");
fs.mkdirSync(path.join(out, "sounds"), { recursive: true });

function png(width, height, paint) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const pixel = Buffer.alloc(4);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x, y, width, height);
      pixel[0] = r;
      pixel[1] = g;
      pixel[2] = b;
      pixel[3] = a;
      pixel.copy(raw, y * (width * 4 + 1) + 1 + x * 4);
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mark(x, y, width, height, background) {
  const cx = (x + 0.5) / width - 0.5;
  const cy = (y + 0.5) / height - 0.5;
  const d = Math.hypot(cx, cy);
  const ring = 0.31;
  const stroke = 0.045;
  const ang = Math.atan2(cy, cx);
  const arc = ang > -2.4 && ang < -0.2;
  if (d < 0.09) return [61, 214, 160, 255];
  if (Math.abs(d - ring) < stroke) return arc ? [61, 139, 255, 255] : [232, 238, 244, 255];
  return background;
}

const icon = png(1024, 1024, (x, y, w, h) => mark(x, y, w, h, [16, 40, 56, 255]));
const splash = png(2732, 2732, (x, y, w, h) => {
  const scale = 0.72;
  const nx = (x - w / 2) / scale + w / 2;
  const ny = (y - h / 2) / scale + h / 2;
  if (nx < 0 || ny < 0 || nx >= w || ny >= h) return [15, 20, 25, 255];
  return mark(nx, ny, w, h, [15, 20, 25, 255]);
});
fs.writeFileSync(path.join(out, "icon.png"), icon);
fs.writeFileSync(path.join(out, "splash.png"), splash);
fs.writeFileSync(path.join(out, "splash-dark.png"), splash);

function wav(samples, rate = 22050) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(sample * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function tone(freq, start, dur, rate, decay, gain) {
  const from = Math.floor(start * rate);
  const count = Math.floor(dur * rate);
  const samples = new Float64Array(from + count);
  for (let i = 0; i < count; i += 1) {
    const t = i / rate;
    samples[from + i] += Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * decay) * gain;
  }
  return samples;
}

function mix(parts) {
  const length = Math.max(...parts.map((part) => part.length));
  const out = new Float64Array(length);
  for (const part of parts) for (let i = 0; i < part.length; i += 1) out[i] += part[i];
  return out;
}

const rate = 22050;
const sounds = {
  chime: mix([tone(660, 0, 0.35, rate, 6, 0.5), tone(880, 0.16, 0.35, rate, 6, 0.4)]),
  bell: mix([tone(784, 0, 0.8, rate, 3, 0.5), tone(1175, 0, 0.45, rate, 4, 0.25)]),
  marimba: mix([
    tone(392, 0, 0.22, rate, 8, 0.5),
    tone(494, 0.16, 0.22, rate, 8, 0.45),
    tone(587, 0.32, 0.3, rate, 7, 0.4),
  ]),
  bowl: mix([tone(220, 0, 1.2, rate, 2, 0.45), tone(330, 0.05, 1, rate, 2.2, 0.22)]),
  pulse: mix([tone(440, 0, 0.14, rate, 10, 0.4), tone(440, 0.2, 0.14, rate, 10, 0.4), tone(523, 0.4, 0.22, rate, 8, 0.35)]),
};
for (const [name, samples] of Object.entries(sounds)) {
  fs.writeFileSync(path.join(out, "sounds", `${name}.wav`), wav(samples, rate));
}
console.log("wrote", out);
