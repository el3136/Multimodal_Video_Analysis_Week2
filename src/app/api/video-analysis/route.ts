import { NextRequest, NextResponse } from "next/server";
import { getGeminiResponse } from "@/utils/geminiClient";
import { env } from "@/app/config/env";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface TranscriptEntry {
  offset: number;
  text: string;
}

interface Topic {
  timestamp: string;
  topic: string;
}

async function fetchTranscript(videoUrl: string) {
  try {
    const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `Please analyze this YouTube video and provide a detailed transcript with timestamps.
    Format each line as [HH:MM:SS] or [MM:SS] followed by the text.
    Make sure to capture all important content and maintain accurate timestamps.
    Return the transcript in this exact format:
    [00:00] First line of transcript
    [00:05] Second line of transcript
    etc.`;

    const result = await model.generateContent([
      prompt,
      {
        fileData: {
          fileUri: videoUrl,
          mimeType: "video/youtube"
        },
      },
    ]);

    const transcriptText = result.response.text();
    console.log("Raw Gemini transcript:", transcriptText);

    // Parse the transcript text into entries
    const entries: TranscriptEntry[] = [];
    const lines = transcriptText.split('\n');

    for (const line of lines) {
      // Match both [MM:SS] and [HH:MM:SS] formats
      const match = line.match(/\[(\d{2}:\d{2}(?::\d{2})?)\]\s*(.*)/);
      if (match) {
        const [, timestamp, text] = match;
        // Split timestamp into components and convert to seconds
        const parts = timestamp.split(':').map(Number);
        let offset;
        if (parts.length === 3) {
          // HH:MM:SS format
          offset = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else {
          // MM:SS format
          offset = parts[0] * 60 + parts[1];
        }

        entries.push({
          offset,
          text: text.trim()
        });
      }
    }

    return entries;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || !body.videoUrl) {
      return NextResponse.json(
        { error: "Video URL is required" },
        { status: 400 }
      );
    }

    console.log("Processing video URL:", body.videoUrl);
    
    // Fetch transcript
    let transcript;
    try {
      transcript = await fetchTranscript(body.videoUrl);
    } catch (error) {
      console.error("Failed to fetch transcript:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to fetch video transcript" },
        { status: 400 }
      );
    }

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: "No transcript found for this video" },
        { status: 400 }
      );
    }
    
    console.log("Raw transcript data:", transcript);

    // Convert transcript timestamps to proper format
    const formattedTranscript = transcript.map((entry: TranscriptEntry) => {
      const totalSeconds = entry.offset;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      // Format as MM:SS
      const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      console.log(`Converting timestamp: ${entry.offset}s -> ${timestamp} (${totalSeconds}s)`);
      
      return {
        timestamp,
        text: entry.text
      };
    });

    console.log("Formatted transcript:", formattedTranscript);

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
    let topicsResult;
    try {
      topicsResult = await getGeminiResponse([
        {
          "role": "user",
          "content": analysisPrompt,
        },
      ]);
      console.log("Received Gemini result", topicsResult);
    } catch (error) {
      console.error("Failed to get topics analysis:", error);
      // Fallback to using transcript entries as topics
      const defaultTopics = formattedTranscript.slice(0, 5).map(entry => ({
        timestamp: entry.timestamp,
        topic: `Topic at ${entry.timestamp}`
      }));
      return NextResponse.json({
        topics: defaultTopics,
        transcript: formattedTranscript
      }, { status: 200 });
    }

    // Parse and validate the topics
    let parsedResult;
    try {
      parsedResult = JSON.parse(topicsResult);
    } catch (error) {
      console.error("Failed to parse topics result:", error);
      // Fallback to using transcript entries as topics
      const defaultTopics = formattedTranscript.slice(0, 5).map(entry => ({
        timestamp: entry.timestamp,
        topic: `Topic at ${entry.timestamp}`
      }));
      return NextResponse.json({
        topics: defaultTopics,
        transcript: formattedTranscript
      }, { status: 200 });
    }

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

    // Return both the topics and the transcript
    return NextResponse.json({
      topics: parsedResult.topics,
      transcript: formattedTranscript
    }, { status: 200 });
  } catch (error) {
    console.error("Video analysis error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while analyzing the video" },
      { status: 500 }
    );
  }
}
