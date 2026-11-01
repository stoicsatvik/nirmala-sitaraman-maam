/** Fail-closed discovery of actual FY programme-budget PDF links, not page furniture. */
export function classifyMaharashtraPublication(
  href: string,
  rowText: string,
  indexUrl: string
): { title: string; sourceUrl: string } | null {
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(href, indexUrl);
  } catch {
    return null;
  }

  if (
    sourceUrl.protocol !== "https:" ||
    !["finance.maharashtra.gov.in", "cdnbbsr.s3waas.gov.in"].includes(sourceUrl.hostname) ||
    !/\.pdf$/i.test(sourceUrl.pathname)
  ) return null;

  // Only an explicit numbered publication table row is evidence of a programme document.
  // An ancestor navigation menu containing "Publications" is not a document.
  const title = rowText.replace(/\s+/g, " ").trim();
  if (
    !/^(?:Publication(?:\s+No\.?)?\s*\d+|प्रकाशन\s+क्रमांक\s*[०-९0-9]+)/iu.test(title) ||
    title.length > 400
  ) return null;

  return { title, sourceUrl: sourceUrl.toString() };
}
