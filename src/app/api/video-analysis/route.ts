import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/app/config/env";
import { YoutubeTranscript } from 'youtube-transcript';
import { getGeminiResponse } from "@/utils/geminiClient";

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();

    console.log(body); // gets videoUrl
    const videoUrl = body.videoUrl;
    const transcript = await YoutubeTranscript.fetchTranscript(videoUrl);

    const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const prompt = `Analyze the following transcript and provide a breakdown of the main topics that are
    discussed in the video, with timestamps for each topic.

      <VideoTranscript>
        Transcript: ${transcript.map((t) => `[${t.offset.toString()}]: ${t.text}`).join("\n")}
      </VideoTranscript>

      Provide your response in the following JSON format:
      {
        "topics": [
          {
            "timestamp": "HH:MM:SS" or "MM:SS",
            "topic": "Topic name",
          }
        ]
      }
    `;

    console.log("Prompt", prompt);

    // response
    const result = await getGeminiResponse([
      {
        "role": "user",
        "content": prompt,
      },
    ]);
    console.log("Received Gemini result", result);

    // TODO: Add input validation here
    // Example: validate required fields like video file, analysis type, etc.
    if (!body) {
      return NextResponse.json(
        { error: "Request body is required" },
        { status: 400 }
      );
    }

    // TODO: Add video analysis logic here
    // This could include:
    // - File upload handling
    // - Video processing
    // - AI/ML analysis
    // - Database operations

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Video analysis error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
