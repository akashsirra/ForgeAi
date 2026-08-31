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
- Use semantic accessible HTML with readable contrast and visible focus states.
- Use JavaScript only when useful. Keep CSS inside <style> and JavaScript inside <script>.
- Do not require npm packages, frameworks, React, Tailwind, or Next.js inside the generated website.
- The website must work inside an iframe using srcDoc.
- Return ONLY a complete standalone HTML document.
- Start with <!DOCTYPE html>.
- Include html, head, charset, viewport, and body.
- Do not return Markdown, code fences, explanations, or analysis.
`;




const MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
];

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

  if (!normalized.startsWith("<!doctype html>")) {
    errors.push("missing <!DOCTYPE html>");
  }

  if (!normalized.includes("<html")) {
    errors.push("missing <html>");
  }

  if (!normalized.includes("<head")) {
    errors.push("missing <head>");
  }

  if (!normalized.includes("<body")) {
    errors.push("missing <body>");
  }

  if (
    !normalized.includes('name="viewport"') &&
    !normalized.includes("name='viewport'")
  ) {
    errors.push("missing viewport metadata");
  }

  if (!normalized.includes("<style")) {
    errors.push("missing <style>");
  }

  if (normalized.includes("```")) {
    errors.push("contains Markdown code fences");
  }

  if (/^\s*(here is|here's|sure|certainly)/i.test(html)) {
    errors.push("contains explanatory text before HTML");
  }

  const scriptOpen = (normalized.match(/<script\b/g) || []).length;
  const scriptClose = (normalized.match(/<\/script>/g) || []).length;

  if (scriptOpen !== scriptClose) {
    errors.push("unbalanced <script> tags");
  }

  if (html.length < 1200) {
    errors.push("HTML output is suspiciously small");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== "string") {
      return Response.json(
        { error: "Please provide a prompt." },
        { status: 400 }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return Response.json(
        { error: "GROQ_API_KEY is not available to the server." },
        { status: 500 }
      );
    }

    let lastError: unknown = null;

    for (const model of MODELS) {
      try {
        console.log(`ForgeAI trying model: ${model}`);

        const result = await generateText({
          model: groq(model),
          maxOutputTokens: 6000,
          system: SYSTEM_PROMPT,
          prompt,
        });

        const html = cleanHtml(result.text);
        const quality = validateHtml(html);

        if (quality.valid) {
          console.log(`ForgeAI success: ${model}`);

          return Response.json({
            html,
            model,
          });
        }

        lastError = new Error(
          `${model} failed HTML quality control: ${quality.errors.join(", ")}`
        );

        console.error(
          `ForgeAI quality control rejected ${model}:`,
          quality.errors
        );
      } catch (error) {
        lastError = error;
        console.error(`ForgeAI ${model} failed:`, error);
      }
    }

    return Response.json(
      {
        error:
          "ForgeAI generation failed. Check the model error below.",
        details:
          lastError instanceof Error ? lastError.message : undefined,
      },
      { status: 503 }
    );
  } catch (error) {
    console.error("FORGEAI API ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI generation failed.",
      },
      { status: 500 }
    );
  }
}
