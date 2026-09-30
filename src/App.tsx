import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const tools = [
  { id: "pdf-word", label: "PDF to Word", icon: "📄" },
  { id: "pdf-excel", label: "PDF to Excel", icon: "📊" },
  { id: "pdf-jpg", label: "PDF to JPG", icon: "🖼️" },
  { id: "jpg-pdf", label: "JPG to PDF", icon: "📎" },
  { id: "word-pdf", label: "Word to PDF", icon: "📝" },
  { id: "excel-pdf", label: "Excel to PDF", icon: "📈" },
  { id: "merge", label: "Merge PDF", icon: "🔗" },
  { id: "split", label: "Split PDF", icon: "✂️" },
  { id: "rotate", label: "Rotate", icon: "🔄" },
  { id: "delete", label: "Delete pages", icon: "🗑️" },
  { id: "extract", label: "Extract pages", icon: "📌" },
  { id: "reorder", label: "Reorder", icon: "↕️" },
  { id: "compress", label: "Compress PDF", icon: "🗜️" },
  { id: "ocr", label: "OCR", icon: "🔍" },
  { id: "scan-word", label: "Scan to Word", icon: "📷" },
  { id: "scan-excel", label: "Scan to Excel", icon: "📷" },
  { id: "scan-pdf", label: "Scan to PDF", icon: "📷" },
];

function BatLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 60" className={className} fill="none">
      <path
        d="M50 15 C40 5, 20 5, 5 20 C15 20, 25 25, 30 30 C20 32, 10 38, 5 50 C20 45, 35 42, 50 35 C65 42, 80 45, 95 50 C90 38, 80 32, 70 30 C75 25, 85 20, 95 20 C80 5, 60 5, 50 15 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function App() {
  const [active, setActive] = useState<string>("pdf-jpg");
  const [hover, setHover] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickFile = async () => {
    try {
      const picked = await open({
        multiple: false,
        filters: [
          { name: "PDF", extensions: ["pdf"] },
          { name: "Все файлы", extensions: ["*"] },
        ],
      });
      if (typeof picked === "string") {
        setFile(picked);
        setResult(null);
        setError(null);
      }
    } catch (e) { console.error(e); }
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // Читаем PDF через Rust
      const raw = await invoke<number[]>("read_bytes", { path: file });
      const data = new Uint8Array(raw);

      // Открываем в pdfjs
      const pdf = await pdfjsLib.getDocument({ data }).promise;

      // Спрашиваем куда сохранить
      const outPath = await save({
        defaultPath: file.replace(/\.pdf$/i, ".jpg"),
        filters: [{ name: "JPEG", extensions: ["jpg"] }],
      });
      if (!outPath) { setBusy(false); return; }

      // Рендерим страницу 1
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      // В JPEG
      const blob: Blob = await new Promise((res) =>
        canvas.toBlob((b) => res(b!), "image/jpeg", 0.92)
      );
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));

      // Пишем через Rust
      await invoke("write_bytes", { path: outPath, data: bytes });

      setResult(outPath);
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bat-bg text-bat-text">
      <header className="sticky top-0 z-50 bg-bat-surface/80 backdrop-blur border-b border-bat-border">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BatLogo className="w-12 h-10 text-bat-yellow drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
            <div className="flex flex-col leading-none">
              <span className="text-2xl font-black tracking-wider">
                OFF<span className="text-bat-yellow">PDF</span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-bat-muted">
                Documents & PDF Converter
              </span>
            </div>
          </div>
          <nav className="hidden md:flex gap-8 text-sm text-bat-muted">
            <a href="#" className="hover:text-bat-yellow transition">Инструменты</a>
            <a href="#" className="hover:text-bat-yellow transition">Приватность</a>
            <a href="#" className="hover:text-bat-yellow transition">GitHub</a>
          </nav>
        </div>
      </header>

      <section className="relative text-center py-12 px-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-bat-yellow/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight max-w-3xl mx-auto leading-tight">
            Работайте с документами{" "}
            <span className="bg-gradient-to-r from-white via-bat-yellow to-bat-gold bg-clip-text text-transparent">
              в тени скорости.
            </span>
          </h1>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-8 w-full">
        <div className="flex items-center justify-between border-b border-bat-border pb-3 mb-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="text-bat-yellow">▮</span> Инструменты
          </h2>
          <span className="text-xs text-bat-muted">{tools.length} доступно</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`p-4 rounded-2xl border bg-bat-card/60 backdrop-blur transition-all text-center flex flex-col items-center gap-2 ${
                active === t.id
                  ? "border-bat-yellow shadow-bat-glow bg-bat-yellow/10"
                  : "border-bat-border hover:border-bat-yellow/60 hover:shadow-bat-glow"
              }`}
            >
              <span className="text-2xl">{t.icon}</span>
              <span className={`text-xs font-semibold ${active === t.id ? "text-bat-yellow" : "text-bat-text"}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-16 w-full">
        <div
          onClick={pickFile}
          onDragEnter={(e) => { e.preventDefault(); setHover(true); }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setHover(false)}
          onDrop={(e) => { e.preventDefault(); setHover(false); }}
          className={`rounded-3xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
            hover
              ? "border-bat-yellow bg-bat-yellow/5 shadow-bat-glow"
              : "border-bat-border hover:border-bat-yellow/80"
          }`}
        >
          {file ? (
            <>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-bat-yellow/10 border border-bat-yellow/40 flex items-center justify-center mb-4">
                <span className="text-3xl">📄</span>
              </div>
              <p className="text-bat-yellow text-sm font-mono break-all px-8 mb-4">{file}</p>

              <button
                onClick={(e) => { e.stopPropagation(); convert(); }}
                disabled={busy}
                className="px-8 py-3 rounded-xl bg-bat-yellow text-black font-bold hover:shadow-bat-glow-lg transition-all disabled:opacity-50"
              >
                {busy ? "Обработка..." : `Конвертировать → JPG`}
              </button>

              {result && (
                <p className="mt-6 text-bat-success text-sm">
                  ✅ Готово: <span className="font-mono">{result}</span>
                </p>
              )}
              {error && (
                <p className="mt-6 text-bat-danger text-sm">❌ {error}</p>
              )}
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto rounded-2xl bg-bat-surface border border-bat-border flex items-center justify-center mb-5">
                <svg viewBox="0 0 24 24" fill="none" stroke="#FACC15" strokeWidth="1.8" className="w-10 h-10">
                  <path d="M12 3L3 7.5V16.5L12 21L21 16.5V7.5L12 3Z" strokeLinejoin="round" />
                  <path d="M3 7.5L12 12L21 7.5" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2">Перетащите PDF сюда</h3>
              <p className="text-bat-muted text-sm">
                или <span className="text-bat-yellow underline">выберите</span> на диске
              </p>
            </>
          )}
        </div>
      </section>

      <footer className="border-t border-bat-border bg-bat-surface/60 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex justify-between text-xs text-bat-muted">
          <div className="flex items-center gap-2">
            <BatLogo className="w-6 h-5 text-bat-yellow" />
            <span className="font-bold text-bat-text">OFFPDF</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-bat-yellow transition">Приватность</a>
            <a href="#" className="hover:text-bat-yellow transition">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}