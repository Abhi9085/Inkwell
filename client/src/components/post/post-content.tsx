
interface PostContentProps {
  sections: {
    id: string;
    heading: string;
    body: string;
  }[];
  tags?: string[] | null;
}

export default function PostContent({
  sections,
  tags,
}: PostContentProps) {
  return (
    <div className="prose-inkwell mx-auto max-w-2xl">
      {sections.map((s, i) => (
        <section key={s.id} id={s.id} className="mb-10">
          {i !== 0 && (
            <h2 className="mb-4 text-2xl font-semibold tracking-tight md:text-3xl">
              {s.heading}
            </h2>
          )}

          {s.body.split("\n\n").filter(Boolean).map((p, idx) => (
            <p
              key={idx}
              className="mb-5 text-[17px] leading-[1.8] text-foreground/90 whitespace-pre-wrap"
            >
              {p}
            </p>
          ))}
        </section>
      ))}

      {tags && tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
