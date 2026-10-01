// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";
import JSZip from "jszip";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

type Tool = { id: string; name: string; desc: string; color: string; icon: string; cat: string };

const tools: Tool[] = [
  // ОРГАНИЗОВАТЬ
  { id: "merge",     cat: "org",  name: "Объединить PDF",   desc: "Склейте несколько PDF-файлов в один.", color: "#e74c3c", icon: "🔗" },
  { id: "split",     cat: "org",  name: "Разделить PDF",    desc: "Каждая страница — отдельный PDF в ZIP.", color: "#e67e22", icon: "✂️" },
  { id: "split-n",   cat: "org",  name: "Разделить каждые N", desc: "Группами по N страниц в отдельные PDF.", color: "#ff9800", icon: "📚" },
  { id: "delete",    cat: "org",  name: "Удалить страницы", desc: "Удалите страницы по номерам (1,3,5-7).", color: "#c0392b", icon: "🗑️" },
  { id: "extract",   cat: "org",  name: "Извлечь страницы", desc: "Оставьте только нужные страницы.", color: "#d35400", icon: "📌" },
  { id: "reverse",   cat: "org",  name: "Обратный порядок", desc: "Перевернуть порядок страниц.", color: "#8e44ad", icon: "↔️" },
  { id: "duplicate", cat: "org",  name: "Дублировать стр.", desc: "Каждая страница повторяется дважды.", color: "#795548", icon: "📑" },
  { id: "crop",      cat: "org",  name: "Обрезка PDF",      desc: "Убрать белые поля по краям.", color: "#607d8b", icon: "📐" },
  { id: "mirror",    cat: "org",  name: "Отразить PDF",     desc: "Горизонтальное отражение страниц.", color: "#5e35b1", icon: "🪞" },
  { id: "nup",       cat: "org",  name: "N-up (несколько на лист)", desc: "2 или 4 страницы на одном листе.", color: "#3949ab", icon: "🧩" },

  // ПРЕОБРАЗОВАТЬ ИЗ PDF
  { id: "pdf-jpg",   cat: "out",  name: "PDF в JPG",        desc: "Каждая страница — JPG в ZIP.", color: "#f39c12", icon: "🖼️" },
  { id: "pdf-png",   cat: "out",  name: "PDF в PNG",        desc: "Каждая страница — PNG в ZIP.", color: "#00bcd4", icon: "🎨" },
  { id: "pdf-txt",   cat: "out",  name: "PDF в текст",      desc: "Извлечь весь текст из PDF.", color: "#607d8b", icon: "📃" },
  { id: "pdf-md",    cat: "out",  name: "PDF в Markdown",   desc: "Текст в формате .md.", color: "#5c6bc0", icon: "📝" },
  { id: "extract-images", cat: "out", name: "Извлечь изображения", desc: "Все картинки из PDF в ZIP.", color: "#ff6f00", icon: "🖼️" },

  // КОНВЕРТАЦИЯ В PDF
  { id: "img-pdf",   cat: "in",   name: "JPG/PNG в PDF",    desc: "Изображения в один PDF.", color: "#e91e63", icon: "📎" },

  // РЕДАКТИРОВАТЬ
  { id: "rotate",    cat: "edit", name: "Повернуть PDF",   desc: "Поверните страницы на 90/180/270°.", color: "#9b59b6", icon: "🔄" },
  { id: "pages",     cat: "edit", name: "Номера страниц",  desc: "Проставить номера внизу.", color: "#009688", icon: "#️⃣" },
  { id: "watermark", cat: "edit", name: "Водяной знак",    desc: "Добавить текст поверх страниц.", color: "#3f51b5", icon: "💧" },
  { id: "sign",      cat: "edit", name: "Подписать PDF",   desc: "Нарисуйте подпись и поставьте на стр. 1.", color: "#4caf50", icon: "✍️" },
  { id: "redact",    cat: "edit", name: "Скрыть данные",   desc: "Закрасить область на каждой странице.", color: "#212121", icon: "⬛" },
  { id: "grayscale", cat: "edit", name: "Чёрно-белый",     desc: "Оттенки серого для всего PDF.", color: "#424242", icon: "⚫" },

  // ОПТИМИЗАЦИЯ
  { id: "compress",  cat: "opt",  name: "Сжать PDF",       desc: "Пересборка структуры, меньше размер.", color: "#43a047", icon: "🗜️" },
  { id: "repair",    cat: "opt",  name: "Восстановить PDF",desc: "Пересобрать повреждённый PDF.", color: "#689f38", icon: "🔧" },
];

const menuColumns = [
  { title: "Организовать PDF",     cat: "org"  },
  { title: "Преобразовать из PDF", cat: "out"  },
  { title: "Конвертация в PDF",    cat: "in"   },
  { title: "Редактировать PDF",    cat: "edit" },
  { title: "Оптимизация PDF",      cat: "opt"  },
];

const cats = [
  { id: "all",  label: "Все" },
  { id: "org",  label: "Организовать PDF" },
  { id: "out",  label: "Преобразовать из PDF" },
  { id: "in",   label: "Конвертация в PDF" },
  { id: "edit", label: "Редактировать PDF" },
  { id: "opt",  label: "Оптимизация PDF" },
];

function BatIcon() { return <span className="text-2xl leading-none">🦇</span>; }

function parseRanges(input: string, total: number): number[] {
  const out = new Set<number>();
  for (const p of input.split(",").map(s => s.trim()).filter(Boolean)) {
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { const a = +m[1], b = +m[2]; for (let i = Math.min(a,b); i <= Math.max(a,b); i++) if (i>=1 && i<=total) out.add(i-1); }
    else if (/^\d+$/.test(p)) { const n = +p; if (n>=1 && n<=total) out.add(n-1); }
  }
  return [...out].sort((a,b) => a-b);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function renderToCanvas(file: File, pageNum: number, scale = 2): Promise<HTMLCanvasElement> {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(pageNum);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width; canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas }).promise;
  return canvas;
}

async function canvasToPdfBlob(canvases: HTMLCanvasElement[], quality = 0.85): Promise<Blob> {
  const doc = await PDFDocument.create();
  for (const c of canvases) {
    const blob: Blob = await new Promise(r => c.toBlob(b => r(b!), "image/jpeg", quality));
    const buf = await blob.arrayBuffer();
    const img = await doc.embedJpg(buf);
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return new Blob([await doc.save()], { type: "application/pdf" });
}

export default function App() {
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState<Tool | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeInput, setRangeInput] = useState("");
  const [rotateDeg, setRotateDeg] = useState(90);
  const [wmText, setWmText] = useState("OFFPDF");
  const [wmOpacity, setWmOpacity] = useState(0.25);
  const [cropMargin, setCropMargin] = useState(20);
  const [splitN, setSplitN] = useState(2);
  const [nupLayout, setNupLayout] = useState<2 | 4>(2);
  const [redact, setRedact] = useState({ x: 20, y: 30, w: 60, h: 15 });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigDrawn = useRef(false);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const visible = filter === "all" ? tools : tools.filter(t => t.cat === filter);
  const openTool = (t: Tool) => { setActive(t); setFiles([]); setError(null); setRangeInput(""); setMenuOpen(false); sigDrawn.current = false; };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files || []);
    if (fs.length) { setFiles(fs); setError(null); }
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = sigCanvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const r = c.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
    sigDrawn.current = true;
    const move = (ev: MouseEvent) => {
      ctx.lineWidth = 2; ctx.strokeStyle = "#000"; ctx.lineCap = "round";
      ctx.lineTo(ev.clientX - r.left, ev.clientY - r.top);
      ctx.stroke();
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const process = async () => {
    if (!active || !files.length) return;
    setBusy(true); setError(null);
    const t = active.id;
    try {
      // MERGE
      if (t === "merge") {
        if (files.length < 2) throw new Error("Нужно минимум 2 PDF");
        const out = await PDFDocument.create();
        for (const f of files) {
          const src = await PDFDocument.load(await f.arrayBuffer());
          (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
        }
        download(new Blob([await out.save()], { type: "application/pdf" }), "merged.pdf");
      }
      // PDF->JPG/PNG
      else if (t === "pdf-jpg" || t === "pdf-png") {
        const zip = new JSZip();
        const ext = t === "pdf-jpg" ? "jpg" : "png";
        const mime = t === "pdf-jpg" ? "jpeg" : "png";
        for (const f of files) {
          const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
          const base = f.name.replace(/\.pdf$/i, "");
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const vp = page.getViewport({ scale: 2 });
            const canvas = document.createElement("canvas");
            canvas.width = vp.width; canvas.height = vp.height;
            await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas }).promise;
            const blob: Blob = await new Promise(r => canvas.toBlob(b => r(b!), `image/${mime}`, 0.92));
            zip.file(`${base}_page_${String(i).padStart(3,"0")}.${ext}`, blob);
          }
        }
        download(await zip.generateAsync({ type: "blob" }), `pdf_${ext}.zip`);
      }
      // SPLIT
      else if (t === "split") {
        const f = files[0];
        const src = await PDFDocument.load(await f.arrayBuffer());
        const zip = new JSZip();
        const base = f.name.replace(/\.pdf$/i, "");
        for (let i = 0; i < src.getPageCount(); i++) {
          const doc = await PDFDocument.create();
          const [p] = await doc.copyPages(src, [i]);
          doc.addPage(p);
          zip.file(`${base}_page_${String(i+1).padStart(3,"0")}.pdf`, await doc.save());
        }
        download(await zip.generateAsync({ type: "blob" }), `${base}_split.zip`);
      }
      // SPLIT-N
      else if (t === "split-n") {
        const f = files[0];
        const src = await PDFDocument.load(await f.arrayBuffer());
        const total = src.getPageCount();
        const zip = new JSZip();
        const base = f.name.replace(/\.pdf$/i, "");
        let part = 1;
        for (let i = 0; i < total; i += splitN) {
          const idx = Array.from({ length: Math.min(splitN, total - i) }, (_, k) => i + k);
          const doc = await PDFDocument.create();
          (await doc.copyPages(src, idx)).forEach(p => doc.addPage(p));
          const from = i + 1, to = i + idx.length;
          zip.file(`${base}_part_${String(part).padStart(2,"0")}_p${from}-${to}.pdf`, await doc.save());
          part++;
        }
        download(await zip.generateAsync({ type: "blob" }), `${base}_parts.zip`);
      }
      // ROTATE
      else if (t === "rotate") {
        const f = files[0];
        const doc = await PDFDocument.load(await f.arrayBuffer());
        doc.getPages().forEach(p => p.setRotation(degrees(rotateDeg)));
        download(new Blob([await doc.save()], { type: "application/pdf" }),
          f.name.replace(/\.pdf$/i, `_rot${rotateDeg}.pdf`));
      }
      // DELETE / EXTRACT
      else if (t === "delete" || t === "extract") {
        const f = files[0];
        const src = await PDFDocument.load(await f.arrayBuffer());
        const total = src.getPageCount();
        const sel = parseRanges(rangeInput, total);
        if (!sel.length) throw new Error("Укажи страницы, напр. 1,3,5-7");
        let keep: number[];
        if (t === "extract") keep = sel;
        else { const s = new Set(sel); keep = Array.from({length: total}, (_,i)=>i).filter(i => !s.has(i)); }
        const out = await PDFDocument.create();
        (await out.copyPages(src, keep)).forEach(p => out.addPage(p));
        download(new Blob([await out.save()], { type: "application/pdf" }),
          f.name.replace(/\.pdf$/i, `_${t}.pdf`));
      }
      // REVERSE
      else if (t === "reverse") {
        const f = files[0];
        const src = await PDFDocument.load(await f.arrayBuffer());
        const out = await PDFDocument.create();
        (await out.copyPages(src, src.getPageIndices().reverse())).forEach(p => out.addPage(p));
        download(new Blob([await out.save()], { type: "application/pdf" }),
          f.name.replace(/\.pdf$/i, "_reversed.pdf"));
      }
      // DUPLICATE
      else if (t === "duplicate") {
        const f = files[0];
        const src = await PDFDocument.load(await f.arrayBuffer());
        const out = await PDFDocument.create();
        for (const i of src.getPageIndices()) {
          const [p1] = await out.copyPages(src, [i]);
          const [p2] = await out.copyPages(src, [i]);
          out.addPage(p1); out.addPage(p2);
        }
        download(new Blob([await out.save()], { type: "application/pdf" }),
          f.name.replace(/\.pdf$/i, "_doubled.pdf"));
      }
      // CROP
      else if (t === "crop") {
        const f = files[0];
        const doc = await PDFDocument.load(await f.arrayBuffer());
        for (const page of doc.getPages()) {
          const { width, height } = page.getSize();
          const m = cropMargin;
          page.setCropBox(m, m, width - 2*m, height - 2*m);
        }
        download(new Blob([await doc.save()], { type: "application/pdf" }),
          f.name.replace(/\.pdf$/i, "_cropped.pdf"));
      }
      // MIRROR
      else if (t === "mirror") {
        const f = files[0];
        const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
        const canvases: HTMLCanvasElement[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 2 });
          const c = document.createElement("canvas");
          c.width = vp.width; c.height = vp.height;
          const ctx = c.getContext("2d")!;
          ctx.translate(vp.width, 0);
          ctx.scale(-1, 1);
          await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
          canvases.push(c);
        }
        download(await canvasToPdfBlob(canvases), f.name.replace(/\.pdf$/i, "_mirrored.pdf"));
      }
      // N-UP
      else if (t === "nup") {
        const f = files[0];
        const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
        const total = pdf.numPages;
        const out: HTMLCanvasElement[] = [];
        const perSheet = nupLayout;
        const cols = perSheet === 2 ? 2 : 2;
        const rows = perSheet === 2 ? 1 : 2;
        for (let start = 1; start <= total; start += perSheet) {
          const first = await pdf.getPage(start);
          const baseVp = first.getViewport({ scale: 2 });
          const pw = baseVp.width, ph = baseVp.height;
          const sheetW = pw * cols;
          const sheetH = ph * rows;
          const sheet = document.createElement("canvas");
          sheet.width = sheetW; sheet.height = sheetH;
          const ctx = sheet.getContext("2d")!;
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, sheetW, sheetH);
          for (let k = 0; k < perSheet; k++) {
            const pageNum = start + k;
            if (pageNum > total) break;
            const page = await pdf.getPage(pageNum);
            const vp = page.getViewport({ scale: 2 });
            const tmp = document.createElement("canvas");
            tmp.width = vp.width; tmp.height = vp.height;
            await page.render({ canvasContext: tmp.getContext("2d")!, viewport: vp, canvas: tmp }).promise;
            const cx = (k % cols) * pw;
            const cy = Math.floor(k / cols) * ph;
            ctx.drawImage(tmp, cx, cy, pw, ph);
          }
          out.push(sheet);
        }
        download(await canvasToPdfBlob(out, 0.9), f.name.replace(/\.pdf$/i, `_${nupLayout}up.pdf`));
      }
      // IMG -> PDF
      else if (t === "img-pdf") {
        const doc = await PDFDocument.create();
        for (const f of files) {
          const buf = await f.arrayBuffer();
          const isPng = f.name.toLowerCase().endsWith(".png");
          const img = isPng ? await doc.embedPng(buf) : await doc.embedJpg(buf);
          const page = doc.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
        download(new Blob([await doc.save()], { type: "application/pdf" }), "images.pdf");
      }
      // PDF -> TXT / MD
      else if (t === "pdf-txt" || t === "pdf-md") {
        const parts: string[] = [];
        for (const f of files) {
          const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
          if (t === "pdf-md") parts.push(`# ${f.name}\n`);
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const text = content.items.map((it: any) => it.str).join(" ");
            if (t === "pdf-md") parts.push(`## Страница ${i}\n\n${text}\n`);
            else parts.push(`--- Страница ${i} ---\n${text}\n`);
          }
        }
        const isMd = t === "pdf-md";
        download(new Blob([parts.join("\n")], { type: isMd ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8" }),
          isMd ? "extracted.md" : "extracted.txt");
      }
      // EXTRACT IMAGES
      else if (t === "extract-images") {
        const zip = new JSZip();
        let count = 0;
        for (const f of files) {
          const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const ops = await page.getOperatorList();
            const names = ops.fnArray.map((fn: number, idx: number) => ({ fn, idx }))
              .filter(x => x.fn === (pdfjsLib as any).OPS.paintImageXObject)
              .map(x => ops.argsArray[x.idx][0]);
            for (const name of names) {
              try {
                const img = await new Promise<any>(res => page.objs.get(name, res));
                const canvas = document.createElement("canvas");
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext("2d")!;
                const data = ctx.createImageData(img.width, img.height);
                data.data.set(img.data);
                ctx.putImageData(data, 0, 0);
                const blob: Blob = await new Promise(r => canvas.toBlob(b => r(b!), "image/png"));
                zip.file(`img_${String(++count).padStart(3,"0")}_p${i}.png`, blob);
              } catch {}
            }
          }
        }
        if (!count) throw new Error("В PDF не найдено встроенных изображений");
        download(await zip.generateAsync({ type: "blob" }), "images.zip");
      }
      // WATERMARK
      else if (t === "watermark") {
        const f = files[0];
        const doc = await PDFDocument.load(await f.arrayBuffer());
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        for (const page of doc.getPages()) {
          const { width, height } = page.getSize();
          const size = Math.min(width, height) / 8;
          const tw = font.widthOfTextAtSize(wmText, size);
          page.drawText(wmText, {
            x: (width - tw) / 2, y: height / 2 - size / 3, size, font,
            color: rgb(0.9, 0.1, 0.1), opacity: wmOpacity, rotate: degrees(45),
          });
        }
        download(new Blob([await doc.save()], { type: "application/pdf" }),
          f.name.replace(/\.pdf$/i, "_watermark.pdf"));
      }
      // PAGE NUMBERS
      else if (t === "pages") {
        const f = files[0];
        const doc = await PDFDocument.load(await f.arrayBuffer());
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pages = doc.getPages();
        pages.forEach((page, i) => {
          const { width } = page.getSize();
          const label = `${i + 1} / ${pages.length}`;
          const tw = font.widthOfTextAtSize(label, 11);
          page.drawText(label, { x: (width - tw) / 2, y: 20, size: 11, font, color: rgb(0.3,0.3,0.3) });
        });
        download(new Blob([await doc.save()], { type: "application/pdf" }),
          f.name.replace(/\.pdf$/i, "_numbered.pdf"));
      }
      // SIGN
      else if (t === "sign") {
        const c = sigCanvasRef.current!;
        const sigBlob: Blob = await new Promise(r => c.toBlob(b => r(b!), "image/png"));
        const sigBuf = await sigBlob.arrayBuffer();
        const f = files[0];
        const doc = await PDFDocument.load(await f.arrayBuffer());
        const png = await doc.embedPng(sigBuf);
        const page = doc.getPages()[0];
        const { width } = page.getSize();
        const w = width / 3;
        const h = w * (png.height / png.width);
        page.drawImage(png, { x: width - w - 30, y: 30, width: w, height: h });
        download(new Blob([await doc.save()], { type: "application/pdf" }),
          f.name.replace(/\.pdf$/i, "_signed.pdf"));
      }
      // REDACT
      else if (t === "redact") {
        const f = files[0];
        const doc = await PDFDocument.load(await f.arrayBuffer());
        for (const page of doc.getPages()) {
          const { width, height } = page.getSize();
          const rx = (redact.x / 100) * width;
          const rw = (redact.w / 100) * width;
          const rh = (redact.h / 100) * height;
          const ry = height - ((redact.y / 100) * height) - rh;
          page.drawRectangle({ x: rx, y: ry, width: rw, height: rh, color: rgb(0,0,0) });
        }
        download(new Blob([await doc.save()], { type: "application/pdf" }),
          f.name.replace(/\.pdf$/i, "_redacted.pdf"));
      }
      // GRAYSCALE
      else if (t === "grayscale") {
        const f = files[0];
        const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
        const canvases: HTMLCanvasElement[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 2 });
          const c = document.createElement("canvas");
          c.width = vp.width; c.height = vp.height;
          const ctx = c.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const d = img.data;
          for (let p = 0; p < d.length; p += 4) {
            const g = 0.299 * d[p] + 0.587 * d[p+1] + 0.114 * d[p+2];
            d[p] = d[p+1] = d[p+2] = g;
          }
          ctx.putImageData(img, 0, 0);
          canvases.push(c);
        }
        download(await canvasToPdfBlob(canvases, 0.85), f.name.replace(/\.pdf$/i, "_grayscale.pdf"));
      }
      // COMPRESS / REPAIR
      else if (t === "compress" || t === "repair") {
        const f = files[0];
        const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
        const bytes = await doc.save({ useObjectStreams: true });
        const suffix = t === "compress" ? "_compressed" : "_repaired";
        download(new Blob([bytes], { type: "application/pdf" }),
          f.name.replace(/\.pdf$/i, `${suffix}.pdf`));
      }
    } catch (e: any) { setError(String(e?.message || e)); }
    finally { setBusy(false); }
  };

  // ===== TOOL PAGE =====
  if (active) {
    const multi = ["merge","pdf-jpg","pdf-png","img-pdf","pdf-txt","pdf-md","extract-images"].includes(active.id);
    const accept = active.id === "img-pdf" ? "image/*" : "application/pdf";
    const needsRange = active.id === "delete" || active.id === "extract";
    const needsWM = active.id === "watermark";

    return (
      <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
        <header className="border-b border-[#21262d] sticky top-0 z-50 bg-[#0d1117]">
          <div className="max-w-[1400px] mx-auto px-8 h-16 flex items-center justify-between">
            <button onClick={() => setActive(null)} className="flex items-center gap-3 hover:opacity-80">
              <BatIcon /><span className="text-2xl font-bold">OFFPDF</span>
            </button>
            <button onClick={() => setActive(null)} className="text-sm text-[#8b949e] hover:text-white">← Назад</button>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-8 py-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: active.color + "22", border: `1px solid ${active.color}55` }}>
              {active.icon}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{active.name}</h1>
              <p className="text-[#8b949e] mt-1">{active.desc}</p>
            </div>
          </div>

          <input ref={inputRef} type="file" accept={accept} multiple={multi} onChange={onPick} className="hidden" />

          {!files.length ? (
            <div onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-[#30363d] hover:border-[#58a6ff] rounded-2xl p-20 text-center cursor-pointer transition-all">
              <div className="text-5xl mb-4">📁</div>
              <p className="text-lg font-semibold mb-2">{multi ? "Выберите файлы" : "Выберите файл"}</p>
              <p className="text-sm text-[#8b949e]">{accept === "image/*" ? "JPG, PNG" : "PDF"}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
                <p className="text-sm text-[#8b949e] mb-2">Файлов: {files.length}</p>
                {files.slice(0, 5).map(f => <div key={f.name} className="text-sm truncate">• {f.name}</div>)}
                {files.length > 5 && <div className="text-sm text-[#8b949e]">…ещё {files.length - 5}</div>}
              </div>

              {needsRange && (
                <div>
                  <label className="block text-sm text-[#8b949e] mb-2">
                    {active.id === "delete" ? "Удалить страницы:" : "Оставить страницы:"}
                  </label>
                  <input value={rangeInput} onChange={e => setRangeInput(e.target.value)}
                    placeholder="1,3,5-7"
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3 outline-none focus:border-[#58a6ff]" />
                </div>
              )}

              {active.id === "rotate" && (
                <div className="flex gap-2">
                  {[90,180,270].map(d => (
                    <button key={d} onClick={() => setRotateDeg(d)}
                      className={`px-5 py-2 rounded-lg border text-sm ${rotateDeg===d ? "bg-white text-black border-white" : "border-[#30363d] text-[#8b949e]"}`}>
                      {d}°
                    </button>
                  ))}
                </div>
              )}

              {active.id === "split-n" && (
                <div>
                  <label className="block text-sm text-[#8b949e] mb-2">Страниц в части: {splitN}</label>
                  <input type="range" min="1" max="20" value={splitN}
                    onChange={e => setSplitN(+e.target.value)} className="w-full" />
                </div>
              )}

              {active.id === "nup" && (
                <div className="flex gap-2">
                  {[2,4].map(n => (
                    <button key={n} onClick={() => setNupLayout(n as 2|4)}
                      className={`px-5 py-2 rounded-lg border text-sm ${nupLayout===n ? "bg-white text-black border-white" : "border-[#30363d] text-[#8b949e]"}`}>
                      {n} страниц на лист
                    </button>
                  ))}
                </div>
              )}

              {active.id === "crop" && (
                <div>
                  <label className="block text-sm text-[#8b949e] mb-2">Поля: {cropMargin}pt</label>
                  <input type="range" min="5" max="80" value={cropMargin}
                    onChange={e => setCropMargin(+e.target.value)} className="w-full" />
                </div>
              )}

              {needsWM && (
                <>
                  <div>
                    <label className="block text-sm text-[#8b949e] mb-2">Текст водяного знака</label>
                    <input value={wmText} onChange={e => setWmText(e.target.value)}
                      className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3 outline-none focus:border-[#58a6ff]" />
                  </div>
                  <div>
                    <label className="block text-sm text-[#8b949e] mb-2">Прозрачность: {Math.round(wmOpacity*100)}%</label>
                    <input type="range" min="0.05" max="0.9" step="0.05" value={wmOpacity}
                      onChange={e => setWmOpacity(+e.target.value)} className="w-full" />
                  </div>
                </>
              )}

              {active.id === "redact" && (
                <div className="space-y-3">
                  <p className="text-sm text-[#8b949e]">Область закраски (% от размера страницы)</p>
                  {[
                    { k: "x", label: "X (слева)" },
                    { k: "y", label: "Y (сверху)" },
                    { k: "w", label: "Ширина" },
                    { k: "h", label: "Высота" },
                  ].map(({k,label}) => (
                    <div key={k}>
                      <label className="block text-xs text-[#8b949e] mb-1">{label}: {redact[k as keyof typeof redact]}%</label>
                      <input type="range" min="0" max="100" value={redact[k as keyof typeof redact]}
                        onChange={e => setRedact({ ...redact, [k]: +e.target.value })} className="w-full" />
                    </div>
                  ))}
                </div>
              )}

              {active.id === "sign" && (
                <div>
                  <label className="block text-sm text-[#8b949e] mb-2">Нарисуйте подпись:</label>
                  <canvas
                    ref={sigCanvasRef}
                    width={500}
                    height={150}
                    onMouseDown={startDraw}
                    className="w-full bg-white rounded-lg cursor-crosshair touch-none"
                  />
                  <button
                    onClick={() => {
                      const c = sigCanvasRef.current!;
                      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
                      sigDrawn.current = false;
                    }}
                    className="mt-2 text-xs text-[#8b949e] hover:text-white"
                  >Очистить</button>
                </div>
              )}

              <button onClick={process} disabled={busy}
                className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-semibold py-3 rounded-lg disabled:opacity-50">
                {busy ? "Обработка..." : `Обработать — ${active.name}`}
              </button>

              <button onClick={() => { setFiles([]); setError(null); }} className="w-full text-sm text-[#8b949e] hover:text-white">
                Выбрать другие файлы
              </button>

              {error && <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">✕ {error}</div>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== MAIN PAGE =====
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <header className="border-b border-[#21262d] sticky top-0 z-50 bg-[#0d1117]">
        <div className="max-w-[1400px] mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <BatIcon />
              <span className="text-2xl font-bold tracking-tight">OFFPDF</span>
            </div>
            <nav className="hidden lg:flex items-center gap-6 text-sm text-[#8b949e]">
              <button onClick={() => setFilter("org")} className="hover:text-white uppercase tracking-wide">Объединить PDF</button>
              <button onClick={() => setFilter("org")} className="hover:text-white uppercase tracking-wide">Разделить PDF</button>
              <button onClick={() => setFilter("opt")} className="hover:text-white uppercase tracking-wide">Сжать PDF</button>
              <button onClick={() => setFilter("out")} className="hover:text-white uppercase tracking-wide">Конвертировать PDF ▾</button>
              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenuOpen(o => !o)}
                  className={`uppercase tracking-wide transition flex items-center gap-1 ${menuOpen ? "text-white" : "hover:text-white"}`}>
                  Все инструменты PDF <span className="text-xs">{menuOpen ? "▴" : "▾"}</span>
                </button>
              </div>
            </nav>
          </div>
          <span className="text-sm text-[#8b949e]">RU/EN</span>
        </div>

        {menuOpen && (
          <div className="absolute left-0 right-0 top-16 bg-[#161b22] border-t border-b border-[#30363d] shadow-2xl z-50">
            <div className="max-w-[1400px] mx-auto px-8 py-8 grid grid-cols-2 md:grid-cols-5 gap-8">
              {menuColumns.map(col => (
                <div key={col.cat}>
                  <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-4">{col.title}</h3>
                  <ul className="space-y-3">
                    {tools.filter(t => t.cat === col.cat).map(t => (
                      <li key={t.id}>
                        <button onClick={() => openTool(t)}
                          className="flex items-center gap-3 text-sm text-[#e6edf3] hover:text-[#58a6ff] transition text-left">
                          <span className="w-5 h-5 flex items-center justify-center text-base">{t.icon}</span>
                          <span>{t.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      <section className="text-center pt-14 pb-10 px-6">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Онлайн — инструменты для любителей PDF</h1>
        <p className="text-[#8b949e] text-lg mt-5 max-w-3xl mx-auto leading-relaxed">
          Бесплатные инструменты для работы с PDF. Всё работает в браузере — файлы не уходят на сервер.
        </p>
      </section>

      <section className="flex flex-wrap justify-center gap-2 px-6 mb-10">
        {cats.map(c => (
          <button key={c.id} onClick={() => setFilter(c.id)}
            className={`px-5 py-2 rounded-full text-sm font-medium border transition-all ${
              filter===c.id ? "bg-white text-[#0d1117] border-white"
                            : "text-[#8b949e] border-[#30363d] hover:border-[#8b949e] hover:text-white"}`}>
            {c.label}
          </button>
        ))}
      </section>

      <section className="max-w-[1400px] mx-auto px-8 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {visible.map(t => (
            <button key={t.id} onClick={() => openTool(t)}
              className="text-left bg-[#161b22] border border-[#30363d] rounded-2xl p-6 hover:border-[#58a6ff] hover:bg-[#1c2128] transition-all group">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ backgroundColor: t.color + "22", border: `1px solid ${t.color}55` }}>
                {t.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-[#58a6ff]">{t.name}</h3>
              <p className="text-sm text-[#8b949e] leading-relaxed">{t.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <footer className="bg-[#010409] border-t border-[#21262d] py-10 px-8 text-center text-xs text-[#8b949e]">
        © 2026 OFFPDF · <a href="https://github.com/almakhanoff/offpdf" className="hover:text-white">GitHub</a>
      </footer>
    </div>
  );
}
