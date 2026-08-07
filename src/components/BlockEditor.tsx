/**
 * BlockEditor — a lightweight, dependency-free block-based rich text editor
 * modeled after Notion / OneNote. Stores blocks as JSON (Block[]).
 *
 * Supported blocks:
 *   - heading (h1/h2/h3)
 *   - paragraph
 *   - bullet list / numbered list items
 *   - checklist
 *   - table (rows × cols)
 *   - image (URL or data URL with caption)
 *   - divider
 *   - callout
 *   - quote
 *   - code
 *   - pdf embed
 *   - attachment (file link)
 *   - drawing (SVG canvas stroke list)
 *
 * Drag-and-drop and clipboard paste of images is supported natively.
 */

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  Bold,
  Italic,
  Underline,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Table as TableIcon,
  Image as ImageIcon,
  Minus,
  Quote,
  Code as CodeIcon,
  FileText as FileTextIcon,
  Trash2,
  GripVertical,
  Plus,
  Link as LinkIcon,
  Brush,
  NotebookPen,
  PlaySquare,
} from "lucide-react";

export type BlockType =
  | "heading1"
  | "heading2"
  | "heading3"
  | "paragraph"
  | "bullet"
  | "numbered"
  | "checklist"
  | "table"
  | "image"
  | "divider"
  | "callout"
  | "quote"
  | "code"
  | "pdf"
  | "youtube"
  | "attachment"
  | "drawing";

export type Block = {
  id: string;
  type: BlockType;
  text?: string;
  level?: number;
  checked?: boolean;
  rows?: string[][];
  url?: string;
  caption?: string;
  mime?: string;
  name?: string;
  color?: string;
  strokes?: DrawingStroke[];
};

export type DrawingStroke = {
  tool: "pen" | "highlighter" | "eraser";
  color: string;
  size: number;
  points: { x: number; y: number }[];
};

export type EditorTheme = "light" | "dark" | "sepia";

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function newBlock(type: BlockType, partial: Partial<Block> = {}): Block {
  return { id: uid(), type, ...partial };
}

function makeEmptyDocument(): Block[] {
  return [
    newBlock("heading1", { text: "" }),
    newBlock("paragraph", { text: "" }),
  ];
}

const TEXT_COLORS: Record<string, string> = {
  default: "",
  red: "text-red-400",
  amber: "text-amber-400",
  emerald: "text-emerald-400",
  blue: "text-blue-400",
  violet: "text-violet-400",
  slate: "text-slate-400",
};

function applyMarks(text: string): string {
  // Inline marks handled with simple markdown-ish parsing for portability.
  // Lightweight: **bold**, _italic_, ~underline~, ==highlight==, `code`
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  let out = escape(text);
  out = out.replace(/==([\s\S]+?)==/g, '<mark class="rounded px-1 bg-yellow-400/30 text-yellow-100">$1</mark>');
  out = out.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/_([\s\S]+?)_/g, "<em>$1</em>");
  out = out.replace(/~([\s\S]+?)~/g, "<u>$1</u>");
  out = out.replace(/`([\s\S]+?)`/g, '<code class="rounded bg-black/30 px-1 text-emerald-300">$1</code>');
  out = out.replace(/\n/g, "<br/>");
  return out;
}

function toYouTubeEmbed(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
    ?? url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`;
}

type ToolbarProps = {
  onCommand: (cmd: ToolbarCmd) => void;
  theme: EditorTheme;
  onTheme: (t: EditorTheme) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  focus: boolean;
  onFocus: () => void;
  split: boolean;
  onSplit: () => void;
};

type ToolbarCmd =
  | "h1"
  | "h2"
  | "h3"
  | "p"
  | "ul"
  | "ol"
  | "check"
  | "table"
  | "image"
  | "divider"
  | "callout"
  | "quote"
  | "code"
  | "pdf"
  | "youtube"
  | "attachment"
  | "drawing";

function Toolbar(p: ToolbarProps) {
  const Btn = ({
    cmd,
    title,
    children,
  }: {
    cmd: ToolbarCmd;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => p.onCommand(cmd)}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-500/15 hover:text-slate-900 dark:hover:text-white"
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white/80 p-1.5 backdrop-blur dark:border-white/10 dark:bg-white/5">
      <Btn cmd="h1" title="Heading 1"><Heading1 className="h-4 w-4" /></Btn>
      <Btn cmd="h2" title="Heading 2"><Heading2 className="h-4 w-4" /></Btn>
      <Btn cmd="h3" title="Heading 3"><Heading3 className="h-4 w-4" /></Btn>
      <Btn cmd="p" title="Paragraph"><NotebookPen className="h-4 w-4" /></Btn>
      <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-white/10" />
      <Btn cmd="ul" title="Bullet list"><List className="h-4 w-4" /></Btn>
      <Btn cmd="ol" title="Numbered list"><ListOrdered className="h-4 w-4" /></Btn>
      <Btn cmd="check" title="Checklist"><CheckSquare className="h-4 w-4" /></Btn>
      <Btn cmd="table" title="Table"><TableIcon className="h-4 w-4" /></Btn>
      <Btn cmd="image" title="Image"><ImageIcon className="h-4 w-4" /></Btn>
      <Btn cmd="pdf" title="Embed PDF"><FileTextIcon className="h-4 w-4" /></Btn>
      <Btn cmd="youtube" title="Embed YouTube"><PlaySquare className="h-4 w-4" /></Btn>
      <Btn cmd="attachment" title="Link or file"><LinkIcon className="h-4 w-4" /></Btn>
      <Btn cmd="drawing" title="Drawing"><Brush className="h-4 w-4" /></Btn>
      <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-white/10" />
      <Btn cmd="callout" title="Callout"><Highlighter className="h-4 w-4" /></Btn>
      <Btn cmd="quote" title="Quote"><Quote className="h-4 w-4" /></Btn>
      <Btn cmd="code" title="Code block"><CodeIcon className="h-4 w-4" /></Btn>
      <Btn cmd="divider" title="Divider"><Minus className="h-4 w-4" /></Btn>
      <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-white/10" />
      <span className="px-2 text-xs text-slate-500">View:</span>
      {(["light", "dark", "sepia"] as EditorTheme[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => p.onTheme(t)}
          className={`rounded-md px-2 py-1 text-xs capitalize transition ${
            p.theme === t ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "text-slate-500 hover:bg-slate-500/10"
          }`}
        >
          {t}
        </button>
      ))}
      <button
        type="button"
        onClick={p.onFocus}
        title="Focus mode (hide distractions)"
        className={`rounded-md px-2 py-1 text-xs ${p.focus ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "text-slate-500 hover:bg-slate-500/10"}`}
      >
        Focus
      </button>
      <button
        type="button"
        onClick={p.onSplit}
        title="Split view with attached document"
        className={`rounded-md px-2 py-1 text-xs ${p.split ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" : "text-slate-500 hover:bg-slate-500/10"}`}
      >
        Split
      </button>
      <button
        type="button"
        onClick={p.onFullscreen}
        title="Fullscreen"
        className={`rounded-md px-2 py-1 text-xs ${p.fullscreen ? "bg-violet-500/20 text-violet-700 dark:text-violet-300" : "text-slate-500 hover:bg-slate-500/10"}`}
      >
        Fullscreen
      </button>
    </div>
  );
}

function InlineTextEditor({
  value,
  onChange,
  onEnter,
  onBackspaceEmpty,
  block,
  className,
  readOnly,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  onBackspaceEmpty?: () => void;
  block: Block;
  className?: string;
  readOnly?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Mirror external value into the contenteditable on every render that brought a change.
  useEffect(() => {
    if (!ref.current) return;
    const current = ref.current.innerText.replace(/\u200b/g, "");
    if (current !== (value ?? "") && document.activeElement !== ref.current) {
      ref.current.innerHTML = applyMarks(value ?? "");
    }
  }, [value, block.id]);

  return (
    <div
      ref={ref}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      role="textbox"
      data-block-id={block.id}
      spellCheck
      className={className}
      {...(placeholder ? { "data-placeholder": placeholder, title: placeholder } : {})}
      onInput={(e) => {
        const txt = (e.currentTarget as HTMLDivElement).innerText.replace(/\u200b/g, "");
        onChange(txt);
      }}
      onPaste={(e) => {
        // Allow rich paste but keep simple behaviour — strip styles.
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onEnter?.();
        }
        if (e.key === "Backspace" && !value && onBackspaceEmpty) {
          e.preventDefault();
          onBackspaceEmpty();
        }
      }}
    />
  );
}

function TableBlock({
  block,
  update,
}: {
  block: Block;
  update: (b: Block) => void;
}) {
  const rows = block.rows ?? [["", ""]];
  const setCell = (r: number, c: number, v: string) => {
    const next = rows.map((row, ri) =>
      row.map((cell, ci) => (ri === r && ci === c ? v : cell))
    );
    update({ ...block, rows: next });
  };
  const addRow = () =>
    update({ ...block, rows: [...rows, Array(rows[0]?.length ?? 2).fill("")] });
  const addCol = () =>
    update({ ...block, rows: rows.map((r) => [...r, ""]) });

  return (
    <div className="my-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border border-slate-200 p-2 dark:border-white/10"
                >
                  <InlineTextEditor
                    block={block}
                    value={cell}
                    onChange={(v) => setCell(ri, ci, v)}
                    className="min-h-[1.5rem] outline-none"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 border-t border-slate-200 bg-slate-50/50 p-2 text-xs dark:border-white/10 dark:bg-white/5">
        <button onClick={addRow} className="rounded px-2 py-1 hover:bg-slate-200 dark:hover:bg-white/10">+ Row</button>
        <button onClick={addCol} className="rounded px-2 py-1 hover:bg-slate-200 dark:hover:bg-white/10">+ Column</button>
      </div>
    </div>
  );
}

function DrawingCanvas({
  block,
  update,
}: {
  block: Block;
  update: (b: Block) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const strokes = block.strokes ?? [];
  const [drawing, setDrawing] = useState<DrawingStroke | null>(null);
  const [color, setColor] = useState("#fde047");
  const [size, setSize] = useState(3);

  const redraw = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) {
      if (s.points.length < 2) continue;
      ctx.strokeStyle = s.tool === "eraser" ? "#ffffff00" : s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = s.tool === "highlighter" ? 0.4 : 1;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [strokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function getXY(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 500,
      y: ((e.clientY - rect.top) / rect.height) * 300,
    };
  }

  return (
    <div className="my-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Pen</span>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded"
        />
        <input
          type="range"
          min={1}
          max={12}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="h-1 w-24 accent-emerald-500"
        />
        <button
          onClick={() => update({ ...block, strokes: [] })}
          className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
        >
          Clear
        </button>
        <button
          onClick={() => {
            const next = strokes.slice(0, -1);
            update({ ...block, strokes: next });
          }}
          className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
        >
          Undo
        </button>
      </div>
      <div className="overflow-hidden rounded border border-slate-200 bg-white dark:border-white/10">
        <canvas
          ref={ref}
          width={500}
          height={300}
          className="block w-full touch-none"
          onPointerDown={(e) => {
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            setDrawing({ tool: "pen", color, size, points: [getXY(e)] });
          }}
          onPointerMove={(e) => {
            if (!drawing) return;
            setDrawing({ ...drawing, points: [...drawing.points, getXY(e)] });
          }}
          onPointerUp={() => {
            if (!drawing) return;
            update({ ...block, strokes: [...strokes, drawing] });
            setDrawing(null);
          }}
        />
      </div>
    </div>
  );
}

function BlockRow({
  block,
  index,
  blocks,
  onChange,
  onCommand,
  onDelete,
  onMoveUp,
  onMoveDown,
  readOnly,
}: {
  block: Block;
  index: number;
  blocks: Block[];
  onChange: (b: Block) => void;
  onCommand: (i: number, t: BlockType) => void;
  onDelete: (i: number) => void;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
  readOnly?: boolean;
}) {
  const update = (b: Block) => onChange(b);
  const insert = (t: BlockType) => onCommand(index, t);
  const isHeading = block.type.startsWith("heading");
  const isBullet = block.type === "bullet" || block.type === "numbered";
  return (
    <div className="group relative flex items-start gap-2 rounded-md px-2 py-1 hover:bg-slate-100/60 dark:hover:bg-white/[0.03]">
      {!readOnly && (
        <div className="flex flex-col items-center gap-1 pt-1 text-slate-400 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            title="Drag handle"
            className="cursor-grab rounded p-1 hover:bg-slate-200 dark:hover:bg-white/10"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onMoveUp(index)}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Move down"
            className="rounded p-1 hover:bg-slate-200 dark:hover:bg-white/10"
            onClick={() => onMoveDown(index)}
          >
            <Plus className="h-3.5 w-3.5 rotate-90" />
          </button>
        </div>
      )}
      <div className="flex-1">
        {block.type === "heading1" && (
          <InlineTextEditor
            block={block}
            value={block.text ?? ""}
            onChange={(v) => update({ ...block, text: v })}
            onEnter={() => insert("paragraph")}
            onBackspaceEmpty={() => onDelete(index)}
            className="block w-full bg-transparent text-3xl font-bold leading-tight outline-none placeholder:text-slate-500/60"
            placeholder="Heading 1"
          />
        )}
        {block.type === "heading2" && (
          <InlineTextEditor
            block={block}
            value={block.text ?? ""}
            onChange={(v) => update({ ...block, text: v })}
            onEnter={() => insert("paragraph")}
            onBackspaceEmpty={() => onDelete(index)}
            className="block w-full bg-transparent text-2xl font-bold leading-snug outline-none placeholder:text-slate-500/60"
            placeholder="Heading 2"
          />
        )}
        {block.type === "heading3" && (
          <InlineTextEditor
            block={block}
            value={block.text ?? ""}
            onChange={(v) => update({ ...block, text: v })}
            onEnter={() => insert("paragraph")}
            onBackspaceEmpty={() => onDelete(index)}
            className="block w-full bg-transparent text-xl font-semibold leading-snug outline-none placeholder:text-slate-500/60"
            placeholder="Heading 3"
          />
        )}
        {block.type === "paragraph" && (
          <InlineTextEditor
            block={block}
            value={block.text ?? ""}
            onChange={(v) => update({ ...block, text: v })}
            onEnter={() => insert("paragraph")}
            onBackspaceEmpty={() => onDelete(index)}
            className="block min-h-[1.6em] w-full bg-transparent text-base leading-7 outline-none placeholder:text-slate-500/60"
            placeholder="Type something…"
          />
        )}
        {block.type === "bullet" && (
          <div className="flex items-start gap-2">
            <span className="select-none pt-1.5 text-slate-500">•</span>
            <InlineTextEditor
              block={block}
              value={block.text ?? ""}
              onChange={(v) => update({ ...block, text: v })}
              onEnter={() => insert("bullet")}
              onBackspaceEmpty={() => onDelete(index)}
              className="flex-1 bg-transparent text-base leading-7 outline-none"
              placeholder="Bullet item"
            />
          </div>
        )}
        {block.type === "numbered" && (
          <div className="flex items-start gap-2">
            <span className="select-none pt-1.5 text-slate-500">{index + 1}.</span>
            <InlineTextEditor
              block={block}
              value={block.text ?? ""}
              onChange={(v) => update({ ...block, text: v })}
              onEnter={() => insert("numbered")}
              onBackspaceEmpty={() => onDelete(index)}
              className="flex-1 bg-transparent text-base leading-7 outline-none"
              placeholder="Numbered item"
            />
          </div>
        )}
        {block.type === "checklist" && (
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={!!block.checked}
              onChange={(e) => update({ ...block, checked: e.target.checked })}
              className="mt-1.5 h-4 w-4 cursor-pointer accent-emerald-500"
            />
            <InlineTextEditor
              block={block}
              value={block.text ?? ""}
              onChange={(v) => update({ ...block, text: v })}
              onEnter={() => insert("checklist")}
              onBackspaceEmpty={() => onDelete(index)}
              className={`flex-1 bg-transparent text-base leading-7 outline-none ${
                block.checked ? "text-slate-500 line-through" : ""
              }`}
              placeholder="To-do"
            />
          </div>
        )}
        {block.type === "callout" && (
          <div className="my-2 flex gap-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
            <span className="text-xl">💡</span>
            <InlineTextEditor
              block={block}
              value={block.text ?? ""}
              onChange={(v) => update({ ...block, text: v })}
              className="flex-1 bg-transparent outline-none"
              placeholder="Highlight important context…"
            />
          </div>
        )}
        {block.type === "quote" && (
          <blockquote className="my-2 border-l-4 border-slate-300 pl-4 text-slate-600 italic dark:border-white/20 dark:text-slate-300">
            <InlineTextEditor
              block={block}
              value={block.text ?? ""}
              onChange={(v) => update({ ...block, text: v })}
              className="w-full bg-transparent outline-none"
              placeholder="Quoted text"
            />
          </blockquote>
        )}
        {block.type === "code" && (
          <pre className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-sm text-emerald-300">
            <InlineTextEditor
              block={block}
              value={block.text ?? ""}
              onChange={(v) => update({ ...block, text: v })}
              className="block w-full bg-transparent outline-none"
              placeholder="// code"
            />
          </pre>
        )}
        {block.type === "divider" && (
          <hr className="my-3 border-slate-200 dark:border-white/10" />
        )}
        {block.type === "image" && block.url ? (
          <figure className="my-2">
            <img
              src={block.url}
              alt={block.caption ?? ""}
              className="max-h-[480px] rounded-lg border border-slate-200 object-contain dark:border-white/10"
            />
            {block.caption !== undefined && (
              <InlineTextEditor
                block={block}
                value={block.caption}
                onChange={(v) => update({ ...block, caption: v })}
                className="mt-1 block w-full bg-transparent text-center text-xs text-slate-500 outline-none"
                placeholder="Image caption"
              />
            )}
          </figure>
        ) : block.type === "image" ? (
          <div className="my-2 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-white/20">
            <ImageIcon className="mx-auto mb-1 h-5 w-5" />
            Paste an image (Ctrl/⌘ + V), drop a file, or upload one.
          </div>
        ) : null}
        {block.type === "pdf" && block.url ? (
          <div className="my-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 text-sm dark:border-white/10">
              <div className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <FileTextIcon className="h-4 w-4 text-rose-500" />
                <span>{block.name ?? "Embedded PDF"}</span>
              </div>
              <a href={block.url} target="_blank" rel="noopener" className="text-blue-600 underline">Open</a>
            </div>
            <iframe src={block.url} title={block.name ?? "Embedded PDF"} className="h-[420px] w-full bg-white" />
          </div>
        ) : null}
        {block.type === "youtube" && block.url ? (
          <div className="my-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 text-sm dark:border-white/10">
              <div className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <PlaySquare className="h-4 w-4 text-red-500" />
                <span>{block.text ?? block.name ?? "YouTube video"}</span>
              </div>
              <a href={block.url} target="_blank" rel="noopener" className="text-blue-600 underline">Open</a>
            </div>
            <iframe src={toYouTubeEmbed(block.url) ?? block.url} title={block.text ?? block.name ?? "YouTube video"} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          </div>
        ) : null}
        {block.type === "attachment" && block.url ? (
          <div className="my-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
            <LinkIcon className="mb-1 mr-2 inline h-4 w-4 text-blue-500" />
            <a href={block.url} target="_blank" rel="noopener" className="text-blue-600 underline">
              {block.name ?? "Attachment"}
            </a>
          </div>
        ) : null}
        {block.type === "table" && (
          <TableBlock block={block} update={update} />
        )}
        {block.type === "drawing" && (
          <DrawingCanvas block={block} update={update} />
        )}
      </div>
      {!readOnly && (
        <button
          type="button"
          title="Delete block"
          onClick={() => onDelete(index)}
          className="rounded p-1 text-slate-400 opacity-0 transition hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      <span className="sr-only">{isHeading ? "heading" : isBullet ? "list" : "block"}</span>
    </div>
  );
}

export type BlockEditorProps = {
  initial?: Block[] | null;
  onChange?: (blocks: Block[]) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  storageKey?: string;
};

export default function BlockEditor({
  initial,
  onChange,
  readOnly,
  className,
  storageKey,
}: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(
    () => initial && initial.length ? initial : makeEmptyDocument()
  );
  const [theme, setTheme] = useState<EditorTheme>("dark");
  const [focus, setFocus] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Hydrate from localStorage if available
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setBlocks(parsed);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  // Debounced auto-save to localStorage
  useEffect(() => {
    if (!storageKey || readOnly) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(blocks));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [blocks, storageKey, readOnly]);

  const setBlockAt = useCallback(
    (i: number, b: Block) => {
      setBlocks((prev) => {
        const next = prev.slice();
        next[i] = b;
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  const insertAt = useCallback(
    (i: number, type: BlockType) => {
      setBlocks((prev) => {
        const nb = newBlock(type);
        const next = [...prev.slice(0, i + 1), nb, ...prev.slice(i + 1)];
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  const deleteAt = useCallback(
    (i: number) => {
      setBlocks((prev) => {
        const next = prev.length === 1 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)];
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  const toolbarCommand = useCallback(
    (cmd: ToolbarCmd) => {
      const appendBlock = (block: Block) => {
        setBlocks((prev) => {
          const tail = prev.length ? prev[prev.length - 1] : newBlock("paragraph");
          const next = [...prev.slice(0, Math.max(prev.length - 1, 0)), block, tail];
          onChange?.(next);
          return next;
        });
      };

      if (cmd === "pdf") {
        const url = window.prompt("PDF URL");
        if (url?.trim()) {
          appendBlock({ id: uid(), type: "pdf", url: url.trim(), name: "Embedded PDF" });
          return;
        }
      }

      if (cmd === "youtube") {
        const url = window.prompt("YouTube URL");
        if (url?.trim()) {
          appendBlock({ id: uid(), type: "youtube", url: url.trim(), text: "YouTube video" });
          return;
        }
      }

      if (cmd === "attachment") {
        const url = window.prompt("Link URL");
        if (url?.trim()) {
          appendBlock({ id: uid(), type: "attachment", url: url.trim(), name: url.trim() });
          return;
        }
      }

      const map: Record<ToolbarCmd, BlockType> = {
        h1: "heading1",
        h2: "heading2",
        h3: "heading3",
        p: "paragraph",
        ul: "bullet",
        ol: "numbered",
        check: "checklist",
        table: "table",
        image: "image",
        divider: "divider",
        callout: "callout",
        quote: "quote",
        code: "code",
        pdf: "pdf",
        youtube: "youtube",
        attachment: "attachment",
        drawing: "drawing",
      };
      insertAt(blocks.length - 1, map[cmd]);
    },
    [blocks.length, insertAt, onChange]
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Upload failed");
    if (file.type.startsWith("image/")) {
      insertAt(blocks.length - 1, "image");
      setBlockAt(blocks.length, {
        id: uid(),
        type: "image",
        url: data.url,
        name: file.name,
        caption: "",
      });
    } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      insertAt(blocks.length - 1, "pdf");
      setBlockAt(blocks.length, {
        id: uid(),
        type: "pdf",
        url: data.url,
        name: file.name,
      });
    } else {
      insertAt(blocks.length - 1, "attachment");
      setBlockAt(blocks.length, {
        id: uid(),
        type: "attachment",
        url: data.url,
        name: file.name,
        mime: file.type,
      });
    }
  }

  function handleContainerPaste(e: ClipboardEvent<HTMLDivElement>) {
    if (readOnly) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file && file.type.startsWith("image/")) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            insertAt(blocks.length - 1, "image");
            setBlockAt(blocks.length, {
              id: uid(),
              type: "image",
              url: String(reader.result),
              name: file.name || "pasted.png",
              caption: "",
            });
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }
  }

  function handleContainerDrop(e: DragEvent<HTMLDivElement>) {
    if (readOnly) return;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length) return;
    e.preventDefault();
    void Promise.all(files.map(handleFileUpload)).catch(() => {});
  }

  const themeClasses = useMemo(() => {
    switch (theme) {
      case "light":
        return "bg-white text-slate-900";
      case "sepia":
        return "bg-amber-50 text-amber-950";
      case "dark":
      default:
        return "bg-slate-900 text-slate-100";
    }
  }, [theme]);

  return (
    <div
      className={`relative ${fullscreen ? "fixed inset-0 z-50 overflow-y-auto" : ""} ${
        focus ? "" : ""
      } ${themeClasses} ${className ?? ""}`}
      onPaste={handleContainerPaste}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleContainerDrop}
    >
      {!readOnly && !focus && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/70 p-2 backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
          <Toolbar
            onCommand={toolbarCommand}
            theme={theme}
            onTheme={setTheme}
            fullscreen={fullscreen}
            onFullscreen={() => setFullscreen((f) => !f)}
            focus={focus}
            onFocus={() => setFocus((f) => !f)}
            split={false}
            onSplit={() => {}}
          />
        </div>
      )}
      <div className={`mx-auto max-w-3xl ${focus ? "py-12" : "py-6"} px-4`}>
        {blocks.map((b, i) => (
          <BlockRow
            key={b.id}
            block={b}
            index={i}
            blocks={blocks}
            onChange={(nb) => setBlockAt(i, nb)}
            onCommand={(idx, t) => insertAt(idx, t)}
            onDelete={(idx) => deleteAt(idx)}
            onMoveUp={(idx) => {
              if (idx === 0) return;
              setBlocks((prev) => {
                const next = prev.slice();
                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                onChange?.(next);
                return next;
              });
            }}
            onMoveDown={(idx) => {
              setBlocks((prev) => {
                if (idx >= prev.length - 1) return prev;
                const next = prev.slice();
                [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                onChange?.(next);
                return next;
              });
            }}
            readOnly={readOnly}
          />
        ))}
        {!readOnly && (
          <button
            type="button"
            onClick={() => insertAt(blocks.length - 1, "paragraph")}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-400 dark:border-white/15 dark:text-slate-400"
          >
            <Plus className="h-4 w-4" /> Add block
          </button>
        )}
      </div>
      {/* Hidden file picker insertion helper */}
      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        onChange={async (e: ChangeEvent<HTMLInputElement>) => {
          const files = Array.from(e.target.files ?? []);
          for (const f of files) await handleFileUpload(f).catch(() => {});
          e.target.value = "";
        }}
      />
    </div>
  );
}
