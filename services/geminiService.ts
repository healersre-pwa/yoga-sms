import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export const generateSubstitutionNotification = async (
  className: string,
  oldTeacherName: string,
  newTeacherName: string,
  classTime: string
): Promise<string> => {
  try {
    // Initialize inside the function to be safe against environment timing issues
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      你是一個 "ZenFlow 瑜伽" 教室的熱心且有禮貌的櫃檯經理。
      請用「繁體中文 (台灣)」寫一則簡短、溫暖且正面的通知訊息（最多 50 字）給學生。
      告知他們：原定 ${classTime} 的 ${className} 課程，老師 ${oldTeacherName} 將由 ${newTeacherName} 代課。
      請簡短地為更換老師致歉，並熱情推薦這位新老師。
      不需要信件主旨。
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || "無法產生通知訊息。";
  } catch (error) {
    console.error("Error generating notification:", error);
    return "注意：本課程的指導老師有所更動。";
  }
};