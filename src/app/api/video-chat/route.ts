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
    Please answer the following question based on the transcript provided:

    Question: ${question}

    <VideoTranscript>
    ${transcript.map((t: any) => `[${t.offset.toString()}]: ${t.text}`).join("\n")}
    </VideoTranscript>

    Please provide a clear and concise answer. If the answer is not found in the transcript, 
    please say so. If you can provide timestamps for relevant parts of the transcript, please include them.`;

    const result = await getGeminiResponse([
      {
        role: "user",
        content: prompt,
      },
    ]);

    return NextResponse.json({ answer: result }, { status: 200 });
  } catch (error) {
    console.error("Video chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
