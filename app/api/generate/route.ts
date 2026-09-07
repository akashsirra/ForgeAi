import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";

const SYSTEM_PROMPT = `
You are ForgeAI, a professional AI website designer and frontend engineer.

Transform the user's idea into a distinctive, polished, production-quality standalone website.

Rules:
- First understand the website type, audience, goal, brand personality, visual direction, sections, and primary CTA.
- Design specifically for the user's idea. Never use a generic SaaS template.
- Choose typography, colors, spacing, composition, imagery, borders, shadows, and interactions appropriate to the idea.
- Do not automatically use a centered hero with three cards.
- Avoid generic purple gradients, excessive glassmorphism, repetitive cards, meaningless statistics, and huge empty areas.
- Use realistic, specific copy. Never use Lorem ipsum.
- Never invent fake customers, awards, statistics, certifications, partnerships, reviews, or claims.
- Use images only when genuinely useful and provide meaningful alt text.
- The layout must remain attractive if external images fail.
- Design mobile-first and make it responsive for phones, tablets, and desktop.
- On small screens, navigation must never cause horizontal page overflow. Collapse, wrap, scroll, or otherwise adapt navigation and dense controls.
- Avoid fixed desktop widths. Prefer max-width, percentages, flex/grid minmax, and responsive sizing.
- Use semantic accessible HTML with readable contrast and visible focus states.
- Ensure buttons and links have comfortable touch targets on mobile.
- Use JavaScript only when useful. Keep CSS inside <style> and JavaScript inside <script>.
- Do not require npm packages, frameworks, React, Tailwind, or Next.js inside the generated website.
- The website must work inside an iframe using srcDoc.
- Return ONLY a complete standalone HTML document.
- Start with <!DOCTYPE html>.
- Include html, head, charset, viewport, and body.
- Do not return Markdown, code fences, explanations, or analysis.
`;

const REPAIR_PROMPT = `
You are ForgeAI's final website quality engineer.

Repair the supplied standalone HTML so it is safe and polished for production, especially on phones.

Mandatory checks:
- valid complete HTML document
- viewport metadata
- no Markdown/code fences
- no horizontal page overflow on narrow screens
- responsive navigation and controls
- no unnecessarily fixed desktop widths
- readable text contrast
- visible keyboard focus states
- comfortable mobile touch targets
- images have meaningful alt text when present
- external images are not required for the layout to remain usable
- preserve the original design, content, branding, and intent
- do not turn the site into a generic template

Return ONLY the repaired complete HTML document beginning with <!DOCTYPE html>.
`;

const MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];

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

  // Media queries are preferred, but fluid clamp/min/max and intrinsic
  // layouts are also valid responsive strategies.
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

async function repairHtml(model: string, html: string, errors: string[]) {
  const result = await generateText({
    model: groq(model),
    maxOutputTokens: 6500,
    system: REPAIR_PROMPT,
    prompt: `Quality-control failures:\n${errors.map((item) => `- ${item}`).join("\n")}\n\nHTML to repair:\n${html}`,
  });

  return cleanHtml(result.text);
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
    if (!process.env.GROQ_API_KEY) {
      return Response.json({ error: "GROQ_API_KEY is not available to the server." }, { status: 500 });
    }

    let lastError: unknown = null;

    for (const model of MODELS) {
      try {
        console.log(`ForgeAI trying model: ${model}`);

        const result = await generateText({
          model: groq(model),
          maxOutputTokens: 6500,
          system: SYSTEM_PROMPT,
          prompt,
        });

        const originalHtml = cleanHtml(result.text);
        const originalQuality = validateHtml(originalHtml);

        if (originalQuality.valid) {
          console.log(`ForgeAI success: ${model}`);
          return Response.json({ html: originalHtml, model, qualityChecked: true });
        }

        console.warn(`ForgeAI quality repair required for ${model}:`, originalQuality.errors);

        // Give repair enough output budget to return the entire document.
        let repairedHtml = await repairHtml(model, originalHtml, originalQuality.errors);
        let repairedQuality = validateHtml(repairedHtml);

        if (!repairedQuality.valid) {
          console.warn(`ForgeAI first repair still failed for ${model}:`, repairedQuality.errors);
          repairedHtml = await repairHtml(model, repairedHtml || originalHtml, repairedQuality.errors);
          repairedQuality = validateHtml(repairedHtml);
        }

        if (repairedQuality.valid) {
          console.log(`ForgeAI success after quality repair: ${model}`);
          return Response.json({ html: repairedHtml, model, qualityChecked: true });
        }

        // Do not turn a usable generation into a hard failure because the
        // heuristic validator missed something. Keep it when it is substantial.
        if (originalHtml.length >= 1200 && originalQuality.errors.length <= 2) {
          console.warn(`ForgeAI keeping original generation after repair miss: ${model}`);
          return Response.json({ html: originalHtml, model, qualityChecked: false });
        }

        lastError = new Error(
          `${model} failed HTML quality control after repair: ${repairedQuality.errors.join(", ")}`
        );
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
