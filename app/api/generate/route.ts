import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";

const ASTRA_MODEL = process.env.OPENAI_MODEL || "gpt-6-astra";
const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

const SYSTEM_PROMPT = `
You are ForgeAI, a senior product designer and frontend engineer building a real website for a real user.

Create a distinctive, polished, production-quality standalone website from the user's idea.

Design requirements:
- Understand the website type, audience, goal, brand personality, visual direction, sections, and primary CTA before designing.
- Make the design specific to the user's idea. Never use a generic SaaS template.
- Choose typography, colors, spacing, composition, imagery, borders, shadows, and interactions that fit the brand.
- Avoid generic purple gradients, excessive glassmorphism, repetitive cards, meaningless statistics, fake testimonials, fake awards, fake customers, and huge empty areas.
- Use realistic, specific copy. Never use Lorem ipsum.
- Never invent facts, certifications, partnerships, reviews, statistics, or claims.
- Make the first viewport visually complete and useful; do not leave a giant empty hero area.
- Design mobile-first for phones, then enhance for tablets and desktop.
- Navigation must never create horizontal overflow on small screens. Use a functional collapse/menu pattern when appropriate.
- Avoid fixed desktop widths. Prefer max-width, percentages, flex/grid minmax, intrinsic sizing, and clamp().
- Use semantic accessible HTML, readable contrast, visible focus states, and comfortable touch targets.
- Every interactive control that looks functional must actually work with small, self-contained JavaScript when needed.
- Do not create a hamburger button that does nothing: mobile navigation must open/close.
- Images must never be a single point of failure. Prefer inline SVG, CSS-generated visuals, gradients, or robust fallback backgrounds for hero imagery. If an external image is used, the surrounding design must remain polished when it fails to load.
- Do not depend on npm packages, frameworks, React, Tailwind, or Next.js inside the generated website.
- The website must work inside an iframe using srcDoc.
- Keep CSS inside <style> and JavaScript inside <script>.
- Return ONLY a complete standalone HTML document beginning with <!DOCTYPE html>.
- Include html, head, charset, viewport, and body.
- Do not return Markdown, code fences, explanations, or analysis.
`;

const REPAIR_PROMPT = `
You are ForgeAI's final website quality engineer and visual polish specialist.

Repair the supplied standalone HTML without changing its core concept, branding, or content.

Mandatory checks:
- complete valid HTML document with <!DOCTYPE html>
- viewport metadata
- no Markdown/code fences
- no horizontal page overflow on narrow screens
- responsive navigation and controls
- functional mobile menu when a hamburger/menu control exists
- no unnecessarily fixed desktop widths
- readable contrast
- visible keyboard focus states
- comfortable mobile touch targets
- meaningful alt text for images
- no broken-image-looking hero or giant empty/grey placeholder area
- external images must have a graceful visual fallback
- buttons and important links must work or have a sensible target
- preserve the original design intent; do not turn it into a generic template

Return ONLY the repaired complete HTML document beginning with <!DOCTYPE html>.
`;

function cleanHtml(text: string) {
  return text
    .trim()
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function validateHtml(html: string) {
  const errors: string[] = [];
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
    errors.push("contains a potentially unsafe fixed minimum width");
  }
  if (/(?:width|min-width)\s*:\s*\d{4,}px/i.test(html)) {
    errors.push("contains an oversized fixed width");
  }

  return { valid: errors.length === 0, errors };
}

function extractOpenAIText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;

  const chunks: string[] = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === "string") chunks.push(content.text);
    }
  }

  return chunks.join("\n").trim();
}

async function generateWithAstra(instructions: string, prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ASTRA_MODEL,
      reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "high" },
      max_output_tokens: 12000,
      instructions,
      input: prompt,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI request failed (${response.status})`);
  }

  const text = extractOpenAIText(data);
  if (!text) throw new Error("OpenAI returned no text output");
  return cleanHtml(text);
}

async function generateWithGroq(model: string, instructions: string, prompt: string) {
  const result = await generateText({
    model: groq(model),
    maxOutputTokens: 9000,
    system: instructions,
    prompt,
  });

  return cleanHtml(result.text);
}

async function repairHtmlWithAstra(html: string, errors: string[]) {
  return generateWithAstra(
    REPAIR_PROMPT,
    `Quality-control failures:\n${errors.map((item) => `- ${item}`).join("\n")}\n\nHTML to repair:\n${html}`
  );
}

async function repairHtmlWithGroq(model: string, html: string, errors: string[]) {
  return generateWithGroq(
    model,
    REPAIR_PROMPT,
    `Quality-control failures:\n${errors.map((item) => `- ${item}`).join("\n")}\n\nHTML to repair:\n${html}`
  );
}

async function qualityPipeline(generate: () => Promise<string>, repair: (html: string, errors: string[]) => Promise<string>) {
  const originalHtml = await generate();
  const originalQuality = validateHtml(originalHtml);

  if (originalQuality.valid) {
    return { html: originalHtml, qualityChecked: true };
  }

  console.warn("ForgeAI quality repair required:", originalQuality.errors);

  let repairedHtml = await repair(originalHtml, originalQuality.errors);
  let repairedQuality = validateHtml(repairedHtml);

  if (!repairedQuality.valid) {
    console.warn("ForgeAI first repair still failed:", repairedQuality.errors);
    repairedHtml = await repair(repairedHtml || originalHtml, repairedQuality.errors);
    repairedQuality = validateHtml(repairedHtml);
  }

  if (repairedQuality.valid) {
    return { html: repairedHtml, qualityChecked: true };
  }

  // A heuristic miss should never destroy a substantial generation.
  if (originalHtml.length >= 1200 && originalQuality.errors.length <= 2) {
    return { html: originalHtml, qualityChecked: false };
  }

  throw new Error(`HTML quality control failed: ${repairedQuality.errors.join(", ")}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== "string") {
      return Response.json({ error: "Please provide a prompt." }, { status: 400 });
    }
    if (prompt.length > 6000) {
      return Response.json({ error: "Prompt is too long. Keep it under 6000 characters." }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
      return Response.json(
        { error: "No AI provider is configured. Add OPENAI_API_KEY or GROQ_API_KEY on the server." },
        { status: 500 }
      );
    }

    let lastError: unknown = null;

    // Astra is the primary production path when an OpenAI key is configured.
    // Groq remains an automatic fallback so existing deployments keep working.
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log(`ForgeAI using ${ASTRA_MODEL}`);
        const result = await qualityPipeline(
          () => generateWithAstra(SYSTEM_PROMPT, prompt),
          repairHtmlWithAstra
        );

        return Response.json({
          html: result.html,
          model: ASTRA_MODEL,
          qualityChecked: result.qualityChecked,
          provider: "openai",
        });
      } catch (error) {
        lastError = error;
        console.error("ForgeAI Astra path failed; falling back to Groq:", error);
      }
    }

    if (!process.env.GROQ_API_KEY) {
      return Response.json(
        {
          error: "ForgeAI's primary AI provider failed and no Groq fallback is configured.",
          details: lastError instanceof Error ? lastError.message : undefined,
        },
        { status: 503 }
      );
    }

    for (const model of GROQ_MODELS) {
      try {
        console.log(`ForgeAI fallback model: ${model}`);
        const result = await qualityPipeline(
          () => generateWithGroq(model, SYSTEM_PROMPT, prompt),
          (html, errors) => repairHtmlWithGroq(model, html, errors)
        );

        return Response.json({
          html: result.html,
          model,
          qualityChecked: result.qualityChecked,
          provider: "groq",
        });
      } catch (error) {
        lastError = error;
        console.error(`ForgeAI ${model} failed:`, error);
      }
    }

    return Response.json(
      {
        error: "ForgeAI could not produce a valid website this time. Please try again with a more specific prompt.",
        details: lastError instanceof Error ? lastError.message : undefined,
      },
      { status: 503 }
    );
  } catch (error) {
    console.error("FORGEAI API ERROR:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "AI generation failed." },
      { status: 500 }
    );
  }
}
