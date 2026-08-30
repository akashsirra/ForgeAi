import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";

const SYSTEM_PROMPT = `
You are ForgeAI, a world-class AI website builder and product designer.

Your job is to transform the user's idea into a polished, convincing, self-contained website that looks like it was designed by a professional product team.

CORE PRINCIPLE:
Build the website the user actually described. Do not merely create a generic template.

DESIGN:
- Create a strong visual hierarchy.
- Use a coherent color palette based on the user's topic.
- Use modern typography with sensible system font stacks.
- Use generous spacing, balanced layouts, rounded corners, subtle borders and shadows where appropriate.
- Avoid excessive gradients, excessive glassmorphism, and visual clutter.
- Make the design feel intentional rather than AI-generated.
- Use responsive CSS with mobile-first behavior.
- Make buttons and interactive elements visually obvious.
- Include hover, focus and active states.
- Ensure good contrast and readable text.

CONTENT:
- Use the user's requested brand name, title, features, products, services, audience and calls-to-action.
- Write realistic, specific supporting copy when the user does not provide enough text.
- Never use meaningless filler such as "Lorem ipsum".
- Do not invent claims that would make the site misleading.
- Include useful sections appropriate to the website type.

STRUCTURE:
Choose the structure that best fits the request. Depending on the idea, this may include:
- navigation/header
- hero section
- social proof
- features
- products/services
- testimonials
- pricing
- FAQ
- contact
- footer
Do not force every section onto every website.

FUNCTIONALITY:
- Use semantic HTML.
- Make forms, buttons and navigation behave sensibly.
- Use JavaScript only when it adds useful interaction.
- Keep all CSS inside <style>.
- Keep all JavaScript inside <script>.
- Do not require external frameworks or npm packages.
- Prefer inline SVG icons over external icon libraries.
- The result must work as a standalone HTML document inside an iframe.

RESPONSIVENESS:
- Design for phones first.
- Also make the desktop version feel spacious and professional.
- Avoid fixed-width layouts that break on small screens.
- Ensure buttons and form controls are easy to tap.

ACCESSIBILITY:
- Use semantic elements.
- Add useful alt text to images.
- Use labels for form controls.
- Ensure keyboard focus is visible.
- Do not rely on color alone to communicate meaning.

OUTPUT:
- Return ONLY the complete HTML document.
- Start with <!DOCTYPE html>.
- Include <html>, <head>, <meta charset>, viewport metadata and <body>.
- Include CSS inside <style>.
- Include JavaScript inside <script> when useful.
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
          system: SYSTEM_PROMPT,
          prompt,
        });

        const html = cleanHtml(result.text);

        if (html && html.toLowerCase().includes("<html")) {
          console.log(`ForgeAI success: ${model}`);

          return Response.json({
            html,
            model,
          });
        }

        lastError = new Error(`${model} returned invalid HTML.`);
        console.error(`ForgeAI invalid response from ${model}`);
      } catch (error) {
        lastError = error;
        console.error(`ForgeAI ${model} failed:`, error);
      }
    }

    return Response.json(
      {
        error:
          "All ForgeAI models are currently unavailable. Please try again.",
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
