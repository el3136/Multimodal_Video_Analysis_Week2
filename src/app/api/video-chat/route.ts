import { NextRequest, NextResponse } from "next/server";
import { getGeminiResponse } from "@/utils/geminiClient";

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

    const prompt = `You are a helpful assistant that answers questions about a video transcript. 
    Please answer the following question based on the transcript provided.
    When referencing specific parts of the video, include the timestamp in the format [MM:SS] or [HH:MM:SS].
    Make sure to include relevant timestamps as citations for your answer.

    Question: ${question}

    <VideoTranscript>
    ${transcript.map((t: any) => `[${t.offset.toString()}]: ${t.text}`).join("\n")}
    </VideoTranscript>

    Please provide a clear and concise answer. If the answer is not found in the transcript, 
    please say so. Always include timestamps as citations when referencing specific parts of the video.
    Format your response as a JSON object with the following structure:
    {
      "answer": "Your answer with [timestamp] citations",
      "citations": [
        {
          "timestamp": "MM:SS or HH:MM:SS",
          "text": "The relevant text from the transcript"
        }
      ]
    }`;

    const result = await getGeminiResponse([
      {
        role: "user",
        content: prompt,
      },
    ]);

    return NextResponse.json(JSON.parse(result), { status: 200 });
  } catch (error) {
    console.error("Video chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
