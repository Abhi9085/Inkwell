import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface PostContentProps {
  sections: {
    id: string;
    heading: string;
    body: string;
  }[];
  tags?: string[] | null;
}

export default function PostContent({ sections, tags }: PostContentProps) {
  return (
    <div className="prose-inkwell mx-auto max-w-2xl">
      {sections.map((section, index) => (
        <section key={section.id} id={section.id} className="mb-10">
          {index !== 0 && (
            <h2 className="mb-4 text-2xl font-semibold tracking-tight md:text-3xl">
              {section.heading}
            </h2>
          )}

          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              img: ({ src, alt }) => {
                if (!src) return null;

                return (
                  <img
                    src={src}
                    alt={alt || "Article image"}
                    loading="lazy"
                    className="my-8 h-auto max-w-full rounded-xl object-contain"
                  />
                );
              },
              p: ({ children }) => (
                <p className="mb-5 text-[17px] leading-[1.8] text-foreground/90">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="my-5 list-disc space-y-2 pl-6">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="my-5 list-decimal space-y-2 pl-6">
                  {children}
                </ol>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-6 border-l-4 border-border pl-4 italic text-muted-foreground">
                  {children}
                </blockquote>
              ),
              pre: ({ children }) => (
                <pre className="my-6 overflow-x-auto rounded-lg bg-secondary p-4">
                  {children}
                </pre>
              ),
            }}
          >
            {section.body}
          </ReactMarkdown>
        </section>
      ))}

      {tags && tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
