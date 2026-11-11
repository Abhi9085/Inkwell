import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Bold,
  Code,
  Eye,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  Quote,
  Save,
  Upload,
  Pencil,
} from "lucide-react";

import { Navbar } from "@/components/navbar";
import api from "../lib/api";

export const Route = createFileRoute("/create")({
  head: () => ({ meta: [{ title: "New story — Inkwell" }] }),
  component: () => <PostEditor mode="create" />,
});

const POST_CATEGORIES = [
  "Educational & How-To Posts",
  "Inspirational & Motivational Posts",
  "Entertaining & Memes",
  "Behind-the-Scenes (BTS)",
  "User-Generated Content (UGC) & Social Proof",
  "Testimonials & Case Studies",
  "Interactive Content",
  "Promotional & Conversion Posts",
  "Storytelling Posts",
  "Infographics & Data Visualizations",
  "General",
];

type EditorMode = "create" | "edit";
type PostStatus = "Draft" | "Public";

type PostEditorProps = {
  mode: EditorMode;
  postId?: number | string;
  initial?: {
    title?: string;
    body?: string;
    cover?: string | null;
    category?: string;
    status?: PostStatus;
    slug?: string;
  };
  lastSavedAt?: string;
};

// A small safe renderer for the Markdown blocks supported by this editor.
// It intentionally renders links as external links and never injects HTML.
function renderInlineMarkdown(text: string): ReactNode[] {
  const pattern = /(\*\*.+?\*\*|\*[^*\n]+\*|`[^`\n]+`|!?\[[^\]]*\]\(https?:\/\/[^\s)]+\))/g;
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-muted px-1 py-0.5">{part.slice(1, -1)}</code>;
    }
    const imageMatch = part.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
    if (imageMatch) {
      return <img key={index} src={imageMatch[2]} alt={imageMatch[1]} className="my-3 max-h-96 max-w-full rounded-lg object-contain" />;
    }
    const linkMatch = part.match(/^\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      return <a key={index} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline">{linkMatch[1]}</a>;
    }
    return <span key={index}>{part}</span>;
  });
}

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(<p key={`p-${blocks.length}`} className="my-3 leading-7">{renderInlineMarkdown(paragraph.join(" "))}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      blocks.push(<ul key={`ul-${blocks.length}`} className="my-3 list-disc space-y-1 pl-6">{listItems.map((item, i) => <li key={i}>{renderInlineMarkdown(item)}</li>)}</ul>);
      listItems = [];
    }
  };

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) {
        blocks.push(<pre key={`code-${index}`} className="my-3 overflow-x-auto rounded-lg bg-muted p-4 text-sm"><code>{codeLines.join("\n")}</code></pre>);
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      return;
    }
    if (inCode) {
      codeLines.push(line);
      return;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const className = level === 1 ? "my-5 text-3xl font-bold" : level === 2 ? "my-4 text-2xl font-semibold" : "my-3 text-xl font-semibold";
      blocks.push(<div key={`h-${index}`} className={className}>{renderInlineMarkdown(heading[2])}</div>);
      return;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph();
      listItems.push(line.replace(/^\s*[-*+]\s+/, ""));
      return;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(<blockquote key={`q-${index}`} className="my-3 border-l-4 border-border pl-4 italic text-muted-foreground">{renderInlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>);
      return;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }
    paragraph.push(line);
  });

  flushParagraph();
  flushList();
  if (inCode && codeLines.length) {
    blocks.push(<pre key="code-end" className="my-3 overflow-x-auto rounded-lg bg-muted p-4 text-sm"><code>{codeLines.join("\n")}</code></pre>);
  }

  return <div className="break-words">{blocks.length ? blocks : <p className="text-muted-foreground">Nothing to preview yet.</p>}</div>;
}

export function PostEditor({ mode, postId, initial, lastSavedAt }: PostEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [cover, setCover] = useState<string | null>(initial?.cover ?? null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [category, setCategory] = useState(initial?.category ?? "General");
  const [status, setStatus] = useState<PostStatus>(initial?.status ?? "Draft");
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const words = useMemo(() => body.trim() ? body.trim().split(/\s+/).length : 0, [body]);
  const readTime = Math.max(1, Math.ceil(words / 220));

  const insertMarkdown = (before: string, after = before, placeholder = "text") => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end);
    const text = selected || placeholder;
    const updated = body.slice(0, start) + before + text + after + body.slice(end);
    setBody(updated);
    setDirty(true);
    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + before.length;
      textarea.setSelectionRange(selectionStart, selectionStart + text.length);
    });
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const updated = body.slice(0, lineStart) + prefix + body.slice(lineStart);
    setBody(updated);
    setDirty(true);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + prefix.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const askForUrl = (kind: "link" | "image") => {
    const rawUrl = window.prompt(`Enter the ${kind} URL (https://...)`);
    if (!rawUrl) return;
    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      toast.error("Please enter a valid URL.");
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      toast.error("Only HTTP and HTTPS URLs are supported.");
      return;
    }
    if (kind === "link") insertMarkdown("[", `](${parsed.href})`, "link text");
    else insertMarkdown("![", `](${parsed.href})`, "image description");
  };

  const editorTools = [
    { icon: Bold, label: "Bold", action: () => insertMarkdown("**", "**", "bold text") },
    { icon: Italic, label: "Italic", action: () => insertMarkdown("*", "*", "italic text") },
    { icon: Heading2, label: "Heading", action: () => insertLinePrefix("## ") },
    { icon: Quote, label: "Quote", action: () => insertLinePrefix("> ") },
    { icon: List, label: "List", action: () => insertLinePrefix("- ") },
    { icon: Code, label: "Code", action: () => insertMarkdown("`", "`", "code") },
    { icon: Link2, label: "Link", action: () => askForUrl("link") },
    { icon: ImageIcon, label: "Image", action: () => askForUrl("image") },
  ];

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB.");
      event.target.value = "";
      return;
    }
    if (cover?.startsWith("blob:")) URL.revokeObjectURL(cover);
    setCoverFile(file);
    setCover(URL.createObjectURL(file));
    setDirty(true);
  };

  const buildFormData = (saveStatus: PostStatus) => {
    const formData = new FormData();
    const generatedSlug = mode === "edit" && initial?.slug
      ? initial.slug
      : title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `post-${Date.now()}`;
    const generatedExcerpt = body.replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim().slice(0, 140);
    formData.append("title", title.trim());
    formData.append("content", body);
    formData.append("category", category);
    formData.append("status", saveStatus);
    formData.append("slug", generatedSlug);
    formData.append("excerpt", generatedExcerpt);
    formData.append("reading_time", String(readTime));
    if (coverFile) formData.append("image", coverFile);
    return formData;
  };

  const savePost = async (saveStatus: PostStatus) => {
    if (!title.trim()) return void toast.error("Please enter a title.");
    if (!body.trim()) return void toast.error("Please enter some content.");
    setIsSaving(true);
    try {
      const formData = buildFormData(saveStatus);
      if (mode === "edit" && postId) await api.put(`/posts/${postId}`, formData);
      else await api.post("/posts", formData);
      setDirty(false);
      toast.success(saveStatus === "Draft"
        ? mode === "edit" ? "Draft updated successfully" : "Draft saved successfully"
        : mode === "edit" ? "Post updated successfully" : "Published successfully");
      navigate({ to: "/profile" });
    } catch (error: any) {
      console.error("Save post error:", error);
      toast.error(error?.response?.data?.error || "Failed to save post");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = () => {
    if (status !== "Public") {
      toast.error("Select Public in Settings to publish this post.");
      return;
    }
    void savePost("Public");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />
      <div className="sticky top-16 z-20 border-b border-border/60 glass">
        <div className="container-page flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{title || "Untitled story"}</p>
            <p className="text-xs text-muted-foreground">
              {dirty ? <span className="text-warning">Unsaved changes</span> : lastSavedAt ? `Last saved ${lastSavedAt}` : mode === "create" ? "Ready to write" : "All changes saved"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setIsPreview((value) => !value)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-secondary">
              {isPreview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {isPreview ? "Edit" : "Preview"}
            </button>
            <button type="button" disabled={isSaving} onClick={() => void savePost("Draft")} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50">
              <Save className="h-4 w-4" />{isSaving ? "Saving..." : "Save draft"}
            </button>
            <button type="button" onClick={handlePublish} disabled={isSaving || status !== "Public"} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-90 disabled:opacity-50">
              {isSaving ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
      </div>

      <main className="container-page grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <input value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} placeholder="Give your story a title" className="w-full bg-transparent text-4xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60 md:text-5xl" />

          <div className="mt-6 flex flex-wrap gap-0.5 rounded-lg border border-border bg-card p-1 shadow-soft">
            {editorTools.map(({ icon: Icon, label, action }) => (
              <button key={label} type="button" onClick={action} title={label} aria-label={label} disabled={isPreview} className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40">
                <Icon className="h-4 w-4" />
              </button>
            ))}
            <span className="mx-1 h-9 w-px bg-border" />
            <span className="grid h-9 place-items-center px-2 text-xs text-muted-foreground">Markdown tools</span>
          </div>

          {isPreview ? (
            <article className="prose prose-neutral dark:prose-invert mt-4 min-h-[500px] max-w-none rounded-lg border border-border bg-card p-6">
              <h1>{title || "Untitled story"}</h1>
              <MarkdownPreview content={body} />
            </article>
          ) : (
            <textarea ref={bodyTextareaRef} value={body} onChange={(event) => { setBody(event.target.value); setDirty(true); }} placeholder="Start writing your story using Markdown..." spellCheck className="mt-4 min-h-[500px] w-full resize-y rounded-lg border border-border bg-card p-6 font-mono text-[15px] leading-[1.8] outline-none focus:border-ring focus:ring-4 focus:ring-ring/15" />
          )}
          <p className="mt-3 text-xs text-muted-foreground">{words} words · {readTime} min read</p>
        </section>

        <aside className="space-y-5 lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Featured image</p>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
            {cover ? (
              <div className="relative overflow-hidden rounded-lg border border-border">
                <img src={cover} alt="Cover preview" className="aspect-video w-full object-cover" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute right-2 top-2 rounded-md bg-background/80 px-2 py-1 text-xs backdrop-blur hover:bg-background">Replace</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="group grid aspect-video w-full place-items-center rounded-lg border-2 border-dashed border-border bg-surface text-center transition-colors hover:border-ring/40 hover:bg-secondary/40">
                <div><div className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-secondary text-muted-foreground group-hover:text-foreground"><Upload className="h-4 w-4" /></div><p className="mt-2 text-sm font-medium">Upload cover image</p><p className="text-xs text-muted-foreground">PNG, JPG, WebP or GIF · Max 5MB</p></div>
              </button>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Settings</p>
            <div className="space-y-3">
              <div><label htmlFor="post-category" className="mb-1.5 block text-xs text-muted-foreground">Category</label><select id="post-category" value={category} onChange={(event) => { setCategory(event.target.value); setDirty(true); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-4 focus:ring-ring/15">{POST_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
              <div><label htmlFor="post-status" className="mb-1.5 block text-xs text-muted-foreground">Status</label><select id="post-status" value={status} onChange={(event) => { setStatus(event.target.value as PostStatus); setDirty(true); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"><option value="Draft">Draft</option><option value="Public">Public</option></select></div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">SEO preview</p>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="truncate text-sm text-accent">inkwell.app/{(title || "your-story").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}</p>
              <p className="mt-1 line-clamp-1 text-[15px] font-semibold text-foreground">{title || "Your story title"}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{body.replace(/[#*_>`]/g, "").replace(/\s+/g, " ").slice(0, 140) || "Your story excerpt will appear here."}</p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Suggested title: {title.trim() ? `${title.trim().length}/60 characters` : "Add a title"}</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
