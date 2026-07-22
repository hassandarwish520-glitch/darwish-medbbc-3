import { chat, TUTOR_SYSTEM } from "./engine";
import { retrieve } from "./rag";

export async function tutorAnswer(question: string, history: { role: "user" | "assistant"; content: string }[] = []) {
  const ctx = await retrieve(question, 8);
  const context = ctx
    .map(
      (c, i) =>
        `[[${i + 1}]] ${c.source_label}: ${c.title}${c.lesson_kind ? ` (${c.lesson_kind})` : ""}\n${c.content}`
    )
    .join("\n\n");

  const messages = [
    { role: "system" as const, content: TUTOR_SYSTEM },
    {
      role: "system" as const,
      content:
        `CONTEXT PRIORITY: Question Bank > HTML Lessons > PDF Lessons > Flashcards > Notes. ` +
        `Use the context first and cite sources as [[n]]. If context is insufficient, say that clearly.\n\n` +
        `CONTEXT:\n${context || "(none)"}`,
    },
    ...history,
    { role: "user" as const, content: question },
  ];

  const answer = await chat(messages, { temperature: 0.2 });
  return {
    answer,
    citations: ctx.map((c, i) => ({
      n: i + 1,
      source_type: c.source_type,
      source_id: c.source_id,
      title: c.title,
      source_label: c.source_label,
      lesson_kind: c.lesson_kind ?? null,
    })),
  };
}

export async function generateQuestions(sourceText: string, count = 5, difficulty = "intermediate") {
  const prompt = `Generate ${count} single-best-answer (SBA) USMLE-style questions from the SOURCE.
Return JSON: { "questions": [{ "stem": "...", "choices":[{"key":"A","text":"..."},...5], "answer_key":"B", "explanation":"...", "difficulty":"${difficulty}", "tags":["..."] }] }
SOURCE:\n${sourceText.slice(0, 8000)}`;
  const raw = await chat(
    [{ role: "system", content: TUTOR_SYSTEM }, { role: "user", content: prompt }],
    { temperature: 0.4, json: true }
  );
  try {
    return JSON.parse(raw).questions ?? [];
  } catch {
    return [];
  }
}

export async function generateFlashcards(sourceText: string, count = 10) {
  const prompt = `Create ${count} high-yield medical flashcards from the SOURCE.
Return JSON: { "cards":[{ "front":"...", "back":"...", "tags":["..."] }] }
Front = concise question / cue. Back = 1-3 sentence answer.
SOURCE:\n${sourceText.slice(0, 8000)}`;
  const raw = await chat(
    [{ role: "system", content: TUTOR_SYSTEM }, { role: "user", content: prompt }],
    { temperature: 0.4, json: true }
  );
  try {
    return JSON.parse(raw).cards ?? [];
  } catch {
    return [];
  }
}

export async function summarize(sourceText: string) {
  return chat(
    [
      { role: "system", content: TUTOR_SYSTEM },
      {
        role: "user",
        content: `Summarize the following medical lesson in 8 bullet points, clinically focused:\n\n${sourceText.slice(0, 8000)}`,
      },
    ],
    { temperature: 0.2 }
  );
}
