import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/app/config/env";
import { YoutubeTranscript } from 'youtube-transcript';
import { getGeminiResponse } from "@/utils/geminiClient";

interface TranscriptEntry {
  offset: number;
  text: string;
}

interface Topic {
  timestamp: string;
  topic: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();

    console.log(body); // gets videoUrl
    const videoUrl = body.videoUrl;
    const transcript = await YoutubeTranscript.fetchTranscript(videoUrl);
    
    console.log("Raw transcript data:", transcript);

    // Convert transcript timestamps to proper format
    const formattedTranscript = transcript.map((entry: TranscriptEntry) => {
      // Convert milliseconds to seconds
      const totalSeconds = Math.floor(entry.offset);
      
      // Calculate hours, minutes, and seconds
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      // Format timestamp based on video length
      const timestamp = hours > 0 
        ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      console.log(`Converting timestamp: ${entry.offset}s -> ${timestamp} (${totalSeconds}s)`);
      
      return {
        timestamp,
        text: entry.text
      };
    });

    console.log("Formatted transcript:", formattedTranscript);

    const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // First, analyze the transcript to find topic changes
    const analysisPrompt = `You are a video content analyzer. Your task is to identify the main topics in this video transcript.

    CRITICAL INSTRUCTIONS:
    1. You MUST use the EXACT timestamps from the transcript below
    2. For each topic, find the timestamp in the transcript where that topic begins
    3. Copy the EXACT timestamp from the transcript, do not modify it
    4. Each topic must have a unique timestamp from the transcript

    <VideoTranscript>
    ${formattedTranscript.map((t) => `[${t.timestamp}]: ${t.text}`).join("\n")}
    </VideoTranscript>

    Example of correct timestamp usage:
    If the transcript shows "[01:23]: This is a new topic", then use "01:23" as the timestamp.

    Return your analysis in this JSON format:
    {
      "topics": [
        {
          "timestamp": "EXACT_TIMESTAMP_FROM_TRANSCRIPT",
          "topic": "Topic name"
        }
      ]
    }`;

    console.log("Analysis Prompt", analysisPrompt);

    // Get topics analysis
    const topicsResult = await getGeminiResponse([
      {
        "role": "user",
        "content": analysisPrompt,
      },
    ]);
    console.log("Received Gemini result", topicsResult);

    // Parse and validate the topics
    const parsedResult = JSON.parse(topicsResult);
    const validTopics = parsedResult.topics.filter((topic: Topic) => {
      // Check if the timestamp exists in the transcript
      return formattedTranscript.some(entry => entry.timestamp === topic.timestamp);
    });

    // If no valid topics found, use the first few transcript entries as topics
    if (validTopics.length === 0) {
      const defaultTopics = formattedTranscript.slice(0, 5).map(entry => ({
        timestamp: entry.timestamp,
        topic: `Topic at ${entry.timestamp}`
      }));
      console.log("Using default topics:", defaultTopics);
      parsedResult.topics = defaultTopics;
    }

    // Validate input
    if (!body) {
      return NextResponse.json(
        { error: "Request body is required" },
        { status: 400 }
      );
    }

    // Return both the topics and the transcript
    return NextResponse.json({
      topics: parsedResult.topics,
      transcript: formattedTranscript
    }, { status: 200 });
  } catch (error) {
    console.error("Video analysis error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
