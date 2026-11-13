/**
 * Prepara os vídeos cinematográficos (gerados com Higgsfield) para a web:
 * - WebM (VP9) e MP4 (H.264, faststart), sem áudio, com largura limitada;
 * - poster WebP do primeiro quadro (mesmo quadro do loop).
 * Fonte: assets/media/source/<nome>.mp4  →  saída: public/media/<nome>.{webm,mp4,webp}
 * Uso: node scripts/process-media.mjs [nome...]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs";
import path from "node:path";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import sharp from "sharp";

const SRC = "assets/media/source";
const OUT = "public/media";
mkdirSync(OUT, { recursive: true });

// largura máxima e qualidade por recurso (fundos borrados/escurecidos aceitam mais compressão)
const PROFILE = {
  hero: { width: 1600, crfVp9: 38, crfH264: 27 },
  // o último quadro gerado não coincide com o primeiro: ida e volta garante um loop sem corte
  // luz ambiente dos projetos: baixa resolução + desfoque no próprio encode (barato de exibir)
  fc26: { width: 640, crfVp9: 42, crfH264: 30, pingpong: true, blur: true },
  fendalume: { width: 640, crfVp9: 42, crfH264: 30, blur: true },
  default: { width: 1280, crfVp9: 40, crfH264: 29 },
};

const run = (args) => execFileSync(ffmpeg.path, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });

const wanted = process.argv.slice(2);
const sources = readdirSync(SRC).filter((f) => f.endsWith(".mp4") && (!wanted.length || wanted.includes(path.basename(f, ".mp4"))));

for (const file of sources) {
  const name = path.basename(file, ".mp4");
  const p = PROFILE[name] ?? PROFILE.default;
  const input = path.join(SRC, file);
  // mantém a taxa de quadros original (24 fps) para não quebrar o loop
  const base = `scale='min(${p.width},iw)':-2:flags=lanczos${p.blur ? ",boxblur=10:2" : ""}`;
  const scale = p.pingpong ? `${base},split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1` : base;

  run(["-i", input, "-an", "-vf", scale, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(p.crfVp9), "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-pix_fmt", "yuv420p", `${OUT}/${name}.webm`]);
  run(["-i", input, "-an", "-vf", scale, "-c:v", "libx264", "-preset", "slow", "-crf", String(p.crfH264), "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${OUT}/${name}.mp4`]);

  const tmp = `${OUT}/${name}.poster.png`;
  run(["-i", input, "-vf", base, "-frames:v", "1", tmp]);
  await sharp(tmp).webp({ quality: 72 }).toFile(`${OUT}/${name}.webp`);
  rmSync(tmp);

  const kb = (f) => Math.round(statSync(`${OUT}/${name}.${f}`).size / 1024);
  console.log(`${name}: webm ${kb("webm")} KB · mp4 ${kb("mp4")} KB · poster ${kb("webp")} KB`);
}
if (!sources.length) console.log(existsSync(SRC) ? "nenhum vídeo em assets/media/source" : "pasta assets/media/source inexistente");
