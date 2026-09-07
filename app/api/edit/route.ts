import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { cleanHtml, hardenHtml, validateHtml } from "../../../lib/site-quality";

const MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
];

const SYSTEM_PROMPT = `
You are ForgeAI, an AI website editor.

You receive an existing HTML website and a user's editing instruction.

Modify ONLY what the user requests while preserving everything else.

Rules:
- Return ONLY the complete updated HTML document.
- Preserve existing design, CSS, JavaScript, links, buttons and functionality unless requested otherwise.
- If the user asks to change visible text, actually change it in the HTML.
- If the user says "change the title", identify the main visible page title, usually an h1.
- Do not create a new website from scratch.
- Do not remove existing content unnecessarily.
- Preserve mobile responsiveness and do not introduce horizontal overflow.
- Preserve functional mobile navigation and interactive controls.
- Preserve image fallbacks and accessibility attributes.
- Keep CSS inside <style>.
- Keep JavaScript inside <script>.
- Do not use Markdown.
- Do not use code fences.
- Do not explain anything outside the HTML.
`;

const REPAIR_PROMPT = `
You are ForgeAI's final website editor quality engineer.

Repair the supplied HTML while preserving the requested edit and the existing design.
Fix only structural or responsive problems that would make the website unreliable.
Return ONLY the complete updated HTML document.
`;

async function repairWithGroq(model: string, html: string, errors: string[]) {
  const result = await generateText({
    model: groq(model),
    maxOutputTokens: 12000,
    system: REPAIR_PROMPT,
    prompt: `Quality issues:\n${errors.map((item) => `- ${item}`).join("\n")}\n\nHTML:\n${html}`,
  });

  return cleanHtml(result.text);
}

export async function POST(req: Request) {
  try {
    const { html, instruction } = await req.json();

    if (!html || !instruction) {
      return Response.json(
        { error: "HTML and instruction are required." },
        { status: 400 }
      );
    }

    if (typeof html !== "string" || typeof instruction !== "string") {
      return Response.json({ error: "HTML and instruction must be text." }, { status: 400 });
    }

    if (html.length > 180000) {
      return Response.json({ error: "This website is too large to edit in one request." }, { status: 413 });
    }

    if (instruction.length > 4000) {
      return Response.json({ error: "Editing instruction is too long. Keep it under 4000 characters." }, { status: 400 });
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
        console.log(`ForgeAI edit trying model: ${model}`);

        const result = await generateText({
          model: groq(model),
          maxOutputTokens: 12000,
          system: SYSTEM_PROMPT,
          prompt: `
EXISTING WEBSITE:
${html}

USER EDITING REQUEST:
${instruction}
`,
        });

        let updatedHtml = hardenHtml(result.text);
        let quality = validateHtml(updatedHtml);

        if (!quality.valid) {
          console.log(`ForgeAI edit repair required: ${quality.errors.join(", ")}`);
          updatedHtml = hardenHtml(await repairWithGroq(model, updatedHtml, quality.errors));
          quality = validateHtml(updatedHtml);
        }

        if (quality.valid && updatedHtml.toLowerCase().includes("<html")) {
          console.log(`ForgeAI edit success: ${model}`);
          return Response.json({
            html: updatedHtml,
            model,
            qualityChecked: true,
            qualityWarnings: quality.warnings,
          });
        }

        if (updatedHtml.length >= 1200 && updatedHtml.toLowerCase().includes("<html")) {
          return Response.json({
            html: updatedHtml,
            model,
            qualityChecked: false,
            qualityWarnings: [...quality.warnings, ...quality.errors],
          });
        }

        lastError = new Error(`${model} returned invalid HTML.`);
      } catch (error) {
        lastError = error;
        console.error(`ForgeAI edit ${model} failed:`, error);
      }
    }

    return Response.json(
      {
        error: "All ForgeAI editing models are currently unavailable.",
        details: lastError instanceof Error ? lastError.message : undefined,
      },
      { status: 503 }
    );
  } catch (error) {
    console.error("FORGEAI EDIT ERROR:", error);

    return Response.json(
      {
        error: error instanceof Error ? error.message : "AI editing failed.",
      },
      { status: 500 }
    );
  }
}
