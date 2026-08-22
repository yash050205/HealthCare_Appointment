const OpenAI = require('openai');

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * Generates a pre-visit summary for the doctor from the patient's symptom text.
 * Returns { ok: true, data } on success or { ok: false, error } on failure.
 * Never throws - callers rely on this to keep booking flow working even if
 * the LLM is down (LLM failures must not break the system).
 */
async function generatePreVisitSummary(symptomText) {
  if (!client) {
    return { ok: false, error: 'LLM not configured (missing OPENAI_API_KEY)' };
  }
  const prompt = `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptomText}

Respond ONLY with valid JSON in this exact shape, no markdown fences:
{"urgency_level": "Low|Medium|High", "chief_complaint": "string", "suggested_questions": ["string","string","string"]}`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a clinical intake assistant. Be concise, factual, and never provide a diagnosis.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 400,
    });

    const raw = response.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { ok: true, data: parsed };
  } catch (err) {
    console.error('[llmService] pre-visit summary failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Converts a doctor's clinical notes + prescription into a patient-friendly summary.
 */
async function generatePostVisitSummary(notes, prescription) {
  if (!client) {
    return { ok: false, error: 'LLM not configured (missing OPENAI_API_KEY)' };
  }
  const prescriptionText = Array.isArray(prescription)
    ? prescription.map(p => `${p.medicine} - ${p.dosage}, ${p.frequency_per_day}x/day for ${p.duration_days} days`).join('; ')
    : '';

  const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${notes}
Prescription: ${prescriptionText}

Write in plain, warm, easy-to-understand language for a patient with no medical background. Keep it under 200 words. Include a short "Medication Schedule" section and a short "Follow-up Steps" section.`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that explains medical notes to patients in simple terms.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 500,
    });

    const text = response.choices[0].message.content.trim();
    return { ok: true, data: text };
  } catch (err) {
    console.error('[llmService] post-visit summary failed:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { generatePreVisitSummary, generatePostVisitSummary };
