import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/app/config/env";

async function getBase64FromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, videoId } = body;

    if (!query || !videoId) {
      return NextResponse.json(
        { error: "Query and videoId are required" },
        { status: 400 }
      );
    }

    // Get the video thumbnail
    const frameUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    
    // Convert image to base64
    const base64Image = await getBase64FromUrl(frameUrl);

    // Initialize Gemini Vision
    const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Analyze the frame with the user's query
    const prompt = `Given this image from a YouTube video and the user's query "${query}", 
    describe what you see in the image and how it relates to the query. 
    If the image doesn't seem relevant to the query, explain why.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      }
    ]);

    const response = await result.response;
    const description = response.text();

    return NextResponse.json({
      results: [{
        timestamp: "00:00",
        description: description,
        frameUrl: frameUrl
      }]
    }, { status: 200 });

  } catch (error) {
    console.error("Visual search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 