/**
 * Gera os assets de marca a partir do logotipo original (assets/brand/tryggport-original.jpg):
 * - marca (símbolo) recortada, recolorida e com fundo transparente;
 * - ícones do site (icon.png, apple-icon.png, favicon.ico);
 * - imagem Open Graph.
 * Execute com: npm run assets
 */
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import { contoursToPath, traceContours } from "./vectorize.mjs";

const SRC = "assets/brand/tryggport-original.jpg";
const GREEN = [0x70, 0xe0, 0xb1];
const SOFT = [0xe9, 0xf1, 0xed];
const BG = "#070B0B";

async function alphaMask() {
  // logotipo preto sobre branco → alfa = escuridão do pixel, com contraste reforçado
  const { data, info } = await sharp(SRC).greyscale().negate().linear(1.6, -60).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function rowHasInk(mask, y, threshold = 60) {
  for (let x = 0; x < mask.width; x++) if (mask.data[y * mask.width + x] > threshold) return true;
  return false;
}

/** Agrupa linhas com tinta em blocos verticais (símbolo, TRYGGPORT, DEV). */
function verticalClusters(mask) {
  const clusters = [];
  let start = -1;
  for (let y = 0; y < mask.height; y++) {
    const ink = rowHasInk(mask, y);
    if (ink && start < 0) start = y;
    if (!ink && start >= 0) {
      if (y - start > 8) clusters.push([start, y - 1]);
      start = -1;
    }
  }
  return clusters;
}

function bboxX(mask, y0, y1, threshold = 60) {
  let min = mask.width;
  let max = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < mask.width; x++)
      if (mask.data[y * mask.width + x] > threshold) {
        if (x < min) min = x;
        if (x > max) max = x;
      }
  return [min, max];
}

async function colored(mask, region, rgb, pad = 0) {
  const { left, top, width, height } = region;
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const a = mask.data[(top + y) * mask.width + (left + x)];
      const i = (y * width + x) * 4;
      out[i] = rgb[0];
      out[i + 1] = rgb[1];
      out[i + 2] = rgb[2];
      out[i + 3] = a;
    }
  let img = sharp(out, { raw: { width, height, channels: 4 } });
  if (pad) img = img.extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  return img.png({ compressionLevel: 9 });
}

function icoFromPng(png) {
  // Contêiner ICO com uma entrada PNG 32x32 (suportado por navegadores modernos).
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

async function main() {
  await mkdir("public/brand", { recursive: true });
  const mask = await alphaMask();
  const clusters = verticalClusters(mask);
  if (clusters.length < 2) throw new Error("não foi possível localizar o símbolo no logotipo");
  const [m0, m1] = clusters[0];
  const [x0, x1] = bboxX(mask, m0, m1);
  const markRegion = { left: x0, top: m0, width: x1 - x0 + 1, height: m1 - m0 + 1 };
  const last = clusters[clusters.length - 1];
  const [lx0, lx1] = bboxX(mask, m0, last[1]);
  const lockRegion = { left: lx0, top: m0, width: lx1 - lx0 + 1, height: last[1] - m0 + 1 };

  const markGreen = await (await colored(mask, markRegion, GREEN)).toBuffer();
  await sharp(markGreen).resize({ height: 256 }).png({ compressionLevel: 9 }).toFile("public/brand/mark.png");
  const markSoft = await (await colored(mask, markRegion, SOFT)).toBuffer();
  await sharp(markSoft).resize({ height: 256 }).png({ compressionLevel: 9 }).toFile("public/brand/mark-light.png");
  const lockup = await (await colored(mask, lockRegion, SOFT)).toBuffer();
  await sharp(lockup).resize({ width: 640 }).png({ compressionLevel: 9 }).toFile("public/brand/lockup-light.png");

  // símbolo vetorizado: usado na animação de revelação (traço que desenha a marca real)
  // traça em 4× (suavizado) para obter diagonais limpas, depois reduz as coordenadas
  const UP = 4;
  const big = await sharp(SRC)
    .extract({ left: markRegion.left, top: markRegion.top, width: markRegion.width, height: markRegion.height })
    .greyscale()
    .negate()
    .resize({ width: markRegion.width * UP, height: markRegion.height * UP, kernel: "lanczos3" })
    .blur(2.2)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bw = big.info.width;
  const bh = big.info.height;
  const filled = (x, y) => x >= 0 && y >= 0 && x < bw && y < bh && big.data[y * bw + x] >= 128;
  const loops = traceContours(bw, bh, filled, 2.6);
  const d = contoursToPath(loops, 1 / UP);
  const viewBox = `0 0 ${markRegion.width} ${markRegion.height}`;
  await writeFile(
    "public/brand/mark.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path fill="#70E0B1" fill-rule="evenodd" d="${d}"/></svg>\n`,
  );
  await writeFile(
    "src/components/brand/mark-geometry.ts",
    `// Gerado por scripts/build-assets.mjs a partir do logotipo original. Não edite à mão.\nexport const MARK_VIEWBOX = "${viewBox}";\nexport const MARK_PATH = "${d}";\n`,
  );

  // pré-visualizações reais dos projetos (capturas datadas em assets/projects)
  await mkdir("public/projects", { recursive: true });
  for (const [src, name] of [
    ["assets/projects/fendalume-capture-2026-11-13.png", "fendalume-preview"],
    ["assets/projects/fc26-capture-2026-11-13.png", "fc26-preview"],
  ]) {
    for (const w of [1440, 720]) {
      await sharp(src).resize({ width: w }).webp({ quality: 80 }).toFile(`public/projects/${name}-${w}.webp`);
    }
  }

  // ícones: símbolo verde sobre o preto da marca
  const iconFor = async (size, padRatio) => {
    const inner = Math.round(size * (1 - padRatio * 2));
    const glyph = await sharp(markGreen).resize({ width: inner, height: inner, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
      .composite([{ input: glyph, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  };
  await writeFile("src/app/icon.png", await iconFor(512, 0.14));
  await writeFile("src/app/apple-icon.png", await iconFor(180, 0.16));
  await writeFile("src/app/favicon.ico", icoFromPng(await iconFor(32, 0.08)));

  // imagem Open Graph 1200x630
  const ogGlyph = await sharp(markGreen).resize({ height: 220 }).toBuffer();
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g" cx="78%" cy="30%" r="70%">
        <stop offset="0" stop-color="#245942" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#080D0D" stop-opacity="0"/>
      </radialGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M40 0H0V40" fill="none" stroke="#70E0B1" stroke-opacity="0.06"/>
      </pattern>
    </defs>
    <rect width="1200" height="630" fill="#080D0D"/>
    <rect width="1200" height="630" fill="url(#grid)"/>
    <rect width="1200" height="630" fill="url(#g)"/>
    <text x="80" y="420" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="92" font-weight="700" fill="#E9F1ED" letter-spacing="2">Tryggport Dev</text>
    <text x="84" y="482" font-family="Consolas, Menlo, monospace" font-size="30" fill="#70E0B1">visitor@tryggport:~$ portfólio_</text>
    <line x1="80" y1="540" x2="1120" y2="540" stroke="#245942" stroke-width="2"/>
    <text x="80" y="580" font-family="Consolas, Menlo, monospace" font-size="22" fill="#87958E">desenvolvimento · experiências digitais · ambiente experimental</text>
  </svg>`;
  await sharp(Buffer.from(svg))
    .composite([{ input: ogGlyph, top: 90, left: 84 }])
    .png({ compressionLevel: 9 })
    .toFile("src/app/opengraph-image.png");

  console.log("assets gerados:", { mark: markRegion, lockup: lockRegion, clusters: clusters.length });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
