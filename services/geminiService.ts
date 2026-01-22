import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, DiagnosticType } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Schema for the question response
const questionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "El enunciado de la pregunta matemática." },
    options: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "4 opciones de respuesta posibles."
    },
    correctIndex: { type: Type.INTEGER, description: "El índice (0-3) de la respuesta correcta." }
  },
  required: ["text", "options", "correctIndex"]
};

export const generateTheoryQuestion = async (): Promise<Question | null> => {
  try {
    const prompt = `
      Genera una pregunta de selección múltiple para estudiantes de séptimo grado (12-13 años) de matemáticas.
      El tema debe ser TEÓRICO y CONCEPTUAL sobre: Uso de signos (ley de signos), propiedades de la igualdad, o normas operativas básicas (jerarquía de operaciones).
      La pregunta debe evaluar la comprensión del concepto, no solo calcular.
      El idioma debe ser Español.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: questionSchema,
        thinkingConfig: { thinkingBudget: 0 } // Speed over deep reasoning for simple trivia
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        id: crypto.randomUUID(),
        text: data.text,
        options: data.options,
        correctIndex: data.correctIndex,
        type: DiagnosticType.THEORY,
        isGeminiGenerated: true
      };
    }
    return null;

  } catch (error) {
    console.error("Error generating question with Gemini:", error);
    return null;
  }
};
