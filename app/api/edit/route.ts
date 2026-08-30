import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";

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
- Keep CSS inside <style>.
- Keep JavaScript inside <script>.
- Do not use Markdown.
- Do not use code fences.
- Do not explain anything outside the HTML.
`;

const MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
];

function cleanHtml(text: string) {
  return text
    .trim()
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
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
          system: SYSTEM_PROMPT,
          prompt: `
EXISTING WEBSITE:
${html}

USER EDITING REQUEST:
${instruction}
`,
        });

        const updatedHtml = cleanHtml(result.text);

        if (updatedHtml && updatedHtml.toLowerCase().includes("<html")) {
          console.log(`ForgeAI edit success: ${model}`);

          return Response.json({
            html: updatedHtml,
            model,
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
        details:
          lastError instanceof Error ? lastError.message : undefined,
      },
      { status: 503 }
    );
  } catch (error) {
    console.error("FORGEAI EDIT ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI editing failed.",
      },
      { status: 500 }
    );
  }
}
