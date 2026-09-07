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

  if (/background(?:-image)?\s*:\s*[^;]*url\s*\(\s*["']?https?:/i.test(html)) {
    warnings.push("one or more CSS background images depend on remote assets");
  }

  if (/aria-label\s*=\s*["'][^"']*(?:menu|navigation)[^"']*["']/i.test(html)) {
    if (!/addEventListener\s*\(\s*["']click["']/i.test(html) && !/<details\b/i.test(html)) {
      warnings.push("menu control may not have a client-side open/close handler");
    }
  }

  if (/<button\b/i.test(html) && !/type\s*=\s*["'](?:button|submit|reset)["']/i.test(html)) {
    warnings.push("one or more buttons omit an explicit type");
  }

  if (/<a\b/i.test(html) && /href\s*=\s*["']#?["']/i.test(html)) {
    warnings.push("one or more links have an empty or placeholder target");
  }

  return { valid: errors.length === 0, errors, warnings };
}

const IMAGE_FALLBACK =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop stop-color="%23151a1f"/%3E%3Cstop offset="1" stop-color="%233a3024"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="1200" height="800" fill="url(%23g)"/%3E%3Ccircle cx="600" cy="350" r="150" fill="%23c88745" opacity=".28"/%3E%3Cpath d="M360 560c80-140 180-210 240-210s160 70 240 210" fill="none" stroke="%23e5c07b" stroke-width="28" stroke-linecap="round" opacity=".7"/%3E%3Ctext x="600" y="690" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="42" font-weight="700" opacity=".88"%3EForgeAI%3C/text%3E%3C/svg%3E';

const IMAGE_FAILURE_HANDLER =
  `this.onerror=null;this.alt='';this.classList.add('forgeai-image-failed');this.src='${IMAGE_FALLBACK}'`;

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
html { max-width: 100%; overflow-x: hidden; }
body { max-width: 100%; min-width: 0 !important; overflow-x: hidden; }
*, *::before, *::after { box-sizing: border-box; }
img, svg, video, canvas { max-width: 100%; }
img { height: auto; }
button, a, input, select, textarea { max-width: 100%; }
button, [role="button"], a { -webkit-tap-highlight-color: transparent; }
img[data-forgeai-image] { display: block; }
img.forgeai-image-failed { object-fit: cover; background: linear-gradient(135deg,#151a1f,#3a3024); }
@media (max-width: 640px) {
  body { min-width: 0 !important; }
  img, video, iframe { max-width: 100% !important; }
  h1 { overflow-wrap: anywhere; }
}
</style>`;

  if (!/data-forgeai-hardening/i.test(result)) {
    result = result.replace(/<\/head>/i, `${hardeningCss}\n</head>`);
  }

  // Keep a deliberate visual layer behind remote CSS images so a failed network
  // request never turns an important hero/card area into a browser-default grey block.
  result = result.replace(
    /(background(?:-image)?\s*:\s*)([^;{}]*url\s*\(\s*["']?https?:\/\/[^;{}]*)(;?)/gi,
    (_match, property, value, ending) =>
      `${property}linear-gradient(135deg, rgba(15,23,42,.92), rgba(59,47,35,.82)), ${value}${ending}`
  );

  result = result.replace(/<img\b([^>]*?)(?:\s*\/?)>/gi, (_match: string, attributes: string) => {
    let next = attributes;
    if (!/\bdata-forgeai-image\b/i.test(next)) next += ' data-forgeai-image="true"';
    if (!/\bloading\s*=/i.test(next)) next += ' loading="lazy"';
    if (!/\bdecoding\s*=/i.test(next)) next += ' decoding="async"';
    if (!/\bonerror\s*=\s*["']/i.test(next)) next += ` onerror="${IMAGE_FAILURE_HANDLER}"`;
    return `<img${next}>`;
  });

  return result;
}
