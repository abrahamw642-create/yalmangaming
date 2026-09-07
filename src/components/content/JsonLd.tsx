import type { JsonLdObject } from "@/lib/seo";

/**
 * Renders one or more JSON-LD graphs into the document.
 *
 * `<` is escaped on the way out. A structured-data payload can contain a
 * product name or a customer-supplied string, and the sequence `</script>`
 * inside a JSON string literal would otherwise close this tag early and turn
 * the rest of the payload into markup.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const payload = Array.isArray(data) ? data : [data];

  return (
    <>
      {payload.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(entry).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}
