import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function translateToEnglish(
  text: string,
  sourceLang: "fr" | "nl" | "auto" = "auto"
): Promise<string> {
  if (!text?.trim()) return text

  const langHint = sourceLang === "auto" ? "French or Dutch" : sourceLang === "fr" ? "French" : "Dutch"

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Translate the following ${langHint} text to English. Return only the translated text, no explanations.`,
      },
      { role: "user", content: text },
    ],
    temperature: 0,
  })

  return response.choices[0].message.content?.trim() ?? text
}
