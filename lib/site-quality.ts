export type SiteQuality = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function cleanHtml(text: string) {
  return text
    .trim()
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function validateHtml(html: string): SiteQuality {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalized = html.trim().toLowerCase();

  if (!normalized.startsWith("<!doctype html>")) errors.push("missing <!DOCTYPE html>");
  if (!normalized.includes("<html")) errors.push("missing <html>");
  if (!normalized.includes("<head")) errors.push("missing <head>");
  if (!normalized.includes("<body")) errors.push("missing <body>");
  if (!normalized.includes('name="viewport"') && !normalized.includes("name='viewport'")) {
    errors.push("missing viewport metadata");
  }
  if (!normalized.includes("<style")) errors.push("missing <style>");
  if (normalized.includes("```")) errors.push("contains Markdown code fences");

  const scriptOpen = (normalized.match(/<script\b/g) || []).length;
  const scriptClose = (normalized.match(/<\/script>/g) || []).length;
  if (scriptOpen !== scriptClose) errors.push("unbalanced <script> tags");

  if (html.length < 1200) errors.push("HTML output is suspiciously small");

  if (!/@media\s*\(/i.test(html) && !/\b(?:clamp|min|max)\s*\(/i.test(html)) {
    errors.push("missing responsive CSS strategy");
  }

  if (/min-width\s*:\s*\d{3,}px/i.test(html)) {
    warnings.push("contains a potentially unsafe fixed minimum width");
  }
  if (/(?:width|min-width)\s*:\s*\d{4,}px/i.test(html)) {
    errors.push("contains an oversized fixed width");
  }

  if (/<img\b/i.test(html)) {
    if (!/alt\s*=\s*["']/i.test(html)) warnings.push("one or more images may be missing alt text");
    if (/https?:\/\//i.test(html) && !/onerror\s*=\s*["']/i.test(html)) {
      warnings.push("external images do not have an explicit fallback");
    }
  }

  if (/aria-label\s*=\s*["'][^"']*(?:menu|navigation)[^"']*["']/i.test(html)) {
    if (!/addEventListener\s*\(\s*["']click["']/i.test(html) && !/<details\b/i.test(html)) {
      warnings.push("menu control may not have a client-side open/close handler");
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function hardenHtml(html: string) {
  let result = cleanHtml(html);

  if (!/<meta\b[^>]*name=["']viewport["']/i.test(result)) {
    result = result.replace(
      /<head([^>]*)>/i,
      '<head$1><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
    );
  }

  const hardeningCss = `
<style data-forgeai-hardening>
html, body { max-width: 100%; overflow-x: hidden; }
*, *::before, *::after { box-sizing: border-box; }
img, svg, video, canvas { max-width: 100%; }
img { height: auto; }
button, a, input, select, textarea { max-width: 100%; }
@media (max-width: 640px) { body { min-width: 0 !important; } }
</style>`;

  if (!/data-forgeai-hardening/i.test(result)) {
    result = result.replace(/<\/head>/i, `${hardeningCss}\n</head>`);
  }

  result = result.replace(/<img\b([^>]*?)(?:\s*\/?)>/gi, (_match: string, attributes: string) => {
    let next = attributes;
    if (!/\bloading\s*=/i.test(next)) next += ' loading="lazy"';
    if (!/\bdecoding\s*=/i.test(next)) next += ' decoding="async"';
    return `<img${next}>`;
  });

  return result;
}
