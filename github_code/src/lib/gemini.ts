import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBKbZUDdrd4izHI0JCenlPo8dipWarTw58";

const ai = new GoogleGenAI({
  apiKey: API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function askAI(prompt: string, context: string = "") {
  if (!API_KEY) {
    throw new Error("AI Assistant is currently unavailable (missing API Key).");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: `You are Memuer AI, the AI helper for Memuer, a secure messaging app. 
        You are helpful, concise, and professional. 
        You can assist with tasks, answer questions, and summarize chats.
        Current chat context (if any): ${context}`,
      }
    });

    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error("AI Error:", error);
    return "I encountered an error while trying to help. Please try again later.";
  }
}

