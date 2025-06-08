import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/app/config/env";
import { getGeminiResponse } from "@/utils/geminiClient";

interface TranscriptEntry {
  timestamp: string;
  text: string;
}

interface Citation {
  timestamp: string;
  text: string;
}

interface ChatResponse {
  answer: string;
  citations: Citation[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, transcript } = body;

    if (!question || !transcript) {
      return NextResponse.json(
        { error: "Question and transcript are required" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Create a structured prompt for the chat
    const chatPrompt = `You are a helpful assistant analyzing a video transcript. Answer the user's question based on the transcript below.

    <VideoTranscript>
    ${transcript.map((t: TranscriptEntry) => `[${t.timestamp}]: ${t.text}`).join("\n")}
    </VideoTranscript>

    <UserQuestion>
    ${question}
    </UserQuestion>

    IMPORTANT INSTRUCTIONS:
    1. Answer the question based ONLY on the transcript content
    2. Include relevant timestamps as citations
    3. Format your response as a JSON object with this structure:
    {
      "answer": "Your answer here",
      "citations": [
        {
          "timestamp": "MM:SS or HH:MM:SS",
          "text": "The relevant text from the transcript"
        }
      ]
    }
    4. Do NOT include timestamps in the answer text
    5. Only use timestamps that exist in the transcript
    6. Make sure your response is valid JSON`;

    // Get chat response
    const result = await getGeminiResponse([
      {
        "role": "user",
        "content": chatPrompt,
      },
    ]);

    console.log("Raw response:", result);

    try {
      // Clean the response to ensure it's valid JSON
      const cleanedResult = result.trim();
      const parsedResult = JSON.parse(cleanedResult) as ChatResponse;

      // Validate the response structure
      if (!parsedResult.answer || !Array.isArray(parsedResult.citations)) {
        throw new Error("Invalid response structure");
      }

      // Clean up the answer text by removing any timestamp citations
      parsedResult.answer = parsedResult.answer.replace(/\[\d{2}:\d{2}(:\d{2})?\]/g, '').trim();

      // Validate citations
      parsedResult.citations = parsedResult.citations.map(citation => ({
        timestamp: citation.timestamp || "00:00",
        text: citation.text || ""
      }));

      return NextResponse.json(parsedResult);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      
      // Fallback: Try to extract a valid answer from the raw response
      const answerMatch = result.match(/"answer":\s*"([^"]+)"/);
      const citationsMatch = result.match(/"citations":\s*(\[[^\]]+\])/);
      
      const fallbackResponse: ChatResponse = {
        answer: answerMatch ? answerMatch[1].replace(/\[\d{2}:\d{2}(:\d{2})?\]/g, '').trim() : "I apologize, but I couldn't provide a proper answer.",
        citations: []
      };

      if (citationsMatch) {
        try {
          const citations = JSON.parse(citationsMatch[1]);
          if (Array.isArray(citations)) {
            fallbackResponse.citations = citations.map((citation: any) => ({
              timestamp: citation.timestamp || "00:00",
              text: citation.text || ""
            }));
          }
        } catch (e) {
          console.error("Failed to parse citations:", e);
        }
      }

      return NextResponse.json(fallbackResponse);
    }
  } catch (error) {
    console.error("Video chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
