"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface Topic {
  timestamp: string;
  topic: string;
}

interface Citation {
  timestamp: string;
  text: string;
}

interface ChatResponse {
  answer: string;
  citations: Citation[];
}

interface VisualSearchResult {
  timestamp: string;
  description: string;
  frameUrl: string;
}

interface TranscriptEntry {
  timestamp: string;
  text: string;
}

interface YouTubePlayerOptions {
  videoId: string;
  playerVars: {
    autoplay: number;
    modestbranding: number;
    rel: number;
  };
  events: {
    onReady: (event: YouTubePlayerEvent) => void;
  };
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
}

interface YouTubePlayer {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, options: YouTubePlayerOptions) => YouTubePlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export function YouTubeInput() {
  // for video topic summary
  const [videoUrl, setVideoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  // for chat
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ChatResponse | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  // for video player
  const [videoId, setVideoId] = useState("");
  const [visualQuery, setVisualQuery] = useState("");
  const [isVisualSearchLoading, setIsVisualSearchLoading] = useState(false);
  const [visualSearchResults, setVisualSearchResults] = useState<VisualSearchResult[]>([]);
  const playerRef = useRef<YouTubePlayer | null>(null);

  useEffect(() => {
    if (!videoId) return;

    // Initialize the player when the API is ready
    if (window.YT) {
      initializePlayer();
    } else {
      window.onYouTubeIframeAPIReady = initializePlayer;
    }

    function initializePlayer() {
      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new window.YT.Player('youtube-player', {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            console.log("Player is ready");
          },
        },
      });
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [videoId]);

  const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // extract video id from url
      const id = extractVideoId(videoUrl);
      if (!id) {
        throw new Error("Invalid YouTube URL");
      }
      setVideoId(id);

      const response = await fetch("/api/video-analysis", {
        method: "POST",
        body: JSON.stringify({ videoUrl }),
      });
      const data = await response.json();
      console.log("Received video analysis data:", data);
      setTopics(data.topics);
      setTranscript(data.transcript);
    } catch (error) {
      console.error("Analysis error:", error);
    }
    setIsLoading(false);
  };

  const handleChat = async () => {
    if (!question.trim() || !transcript.length) return;
    
    setIsChatLoading(true);
    try {
      const response = await fetch("/api/video-chat", {
        method: "POST",
        body: JSON.stringify({ question, transcript }),
      });
      const data = await response.json();
      setAnswer(data);
    } catch (error) {
      console.error("Chat error:", error);
      setAnswer({
        answer: "I apologize, but I'm having trouble processing your question right now. Please try again.",
        citations: []
      });
    }
    setIsChatLoading(false);
  };

  const handleVisualSearch = async () => {
    if (!visualQuery.trim() || !videoId) return;
    
    setIsVisualSearchLoading(true);
    try {
      const response = await fetch("/api/visual-search", {
        method: "POST",
        body: JSON.stringify({ 
          query: visualQuery,
          videoId: videoId
        }),
      });
      const data = await response.json();
      setVisualSearchResults(data.results);
    } catch (error) {
      console.error("Visual search error:", error);
    }
    setIsVisualSearchLoading(false);
  };

  const handleTimestampClick = (timestamp: string) => {
    if (!playerRef.current) return;

    console.log("Handling timestamp click:", timestamp);

    // Convert timestamp to seconds
    const parts = timestamp.split(':').map(Number);
    let totalSeconds = 0;

    if (parts.length === 2) {
      // MM:SS format
      totalSeconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS format
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    console.log(`Seeking to ${totalSeconds} seconds (timestamp: ${timestamp})`);
    
    // Seek to the timestamp
    playerRef.current.seekTo(totalSeconds, true);
  };

  const formatAnswer = (answer: string | undefined) => {
    if (!answer) return "I apologize, but I'm having trouble processing your question right now. Please try again.";
    
    // Replace ["timestamp"] with clickable buttons
    return answer.split(/(\[\"\d{2}:\d{2}(?::\d{2})?\"\])/).map((part, index) => {
      if (part.match(/\[\"\d{2}:\d{2}(?::\d{2})?\"\]/)) {
        const timestamp = part.slice(2, -2); // Remove [" and "]
        return (
          <button
            key={index}
            onClick={() => handleTimestampClick(timestamp)}
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {part}
          </button>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="youtube-url"
            className="block text-sm font-medium text-zinc-300 mb-2"
          >
            YouTube Video URL
          </label>
          <input
            id="youtube-url"
            type="url"
            value={videoUrl}
            onChange={e => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <button
          type="button"
          disabled={!videoUrl.trim()}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
          onClick={handleSubmit}
        >
          {isLoading ? "Analyzing" : "Analyze Video"}
        </button>
        {/* loading spinner */}
        {isLoading && (
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600" />
          </div>
        )}
        {/* video player */}
        {videoId && (
          <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg">
            <div id="youtube-player" className="w-full h-full" />
          </div>
        )}
        {/* video topics timeline */}
        {topics.length > 0 && (
          <div className="mt-4 p-4 bg-zinc-900 rounded-lg">
            <h3 className="text-lg font-semibold text-zinc-300 mb-2">
              Video Topics Timeline
            </h3>
            <div className="space-y-3">
              {topics.map((item, index) => (
                <div key={index} className="flex items-start gap-3 text-sm">
                  <button
                    onClick={() => handleTimestampClick(item.timestamp)}
                    className="min-w-[60px] px-2 py-1 bg-zinc-800 rounded text-zinc-300 font-mono hover:bg-zinc-700 transition-colors"
                  >
                    {item.timestamp}
                  </button>
                  <span className="text-zinc-400">{item.topic}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Ask Questions About the Video */}
        {transcript.length > 0 && (
          <div className="mt-8 space-y-8">
            {/* Chat Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-zinc-300">
                Ask Questions About the Video
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Ask a question about the video..."
                  className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  disabled={!question.trim() || isChatLoading}
                  onClick={handleChat}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                >
                  {isChatLoading ? "Thinking..." : "Ask Question"}
                </button>
              </div>

              {answer && (
                <div className="mt-4 p-4 bg-zinc-900 rounded-lg">
                  <h4 className="text-sm font-medium text-zinc-300 mb-2">Answer:</h4>
                  <div className="space-y-4">
                    <div className="text-zinc-400">
                      {formatAnswer(answer.answer)}
                    </div>
                    {answer.citations && answer.citations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-zinc-800">
                        <h5 className="text-sm font-medium text-zinc-300 mb-2">Citations:</h5>
                        <div className="space-y-2">
                          {answer.citations.map((citation, index) => (
                            <div key={index} className="text-sm text-zinc-400">
                              <button
                                onClick={() => handleTimestampClick(citation.timestamp)}
                                className="text-blue-400 hover:text-blue-300 underline mr-2"
                              >
                                [{citation.timestamp}]
                              </button>
                              {citation.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Visual Search Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-zinc-300">
                Visual Search
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  value={visualQuery}
                  onChange={e => setVisualQuery(e.target.value)}
                  placeholder="Describe what you're looking for in the video..."
                  className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  disabled={!visualQuery.trim() || isVisualSearchLoading}
                  onClick={handleVisualSearch}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                >
                  {isVisualSearchLoading ? "Searching..." : "Search Video"}
                </button>
              </div>

              {visualSearchResults && visualSearchResults.length > 0 && (
                <div className="mt-4 p-4 bg-zinc-900 rounded-lg">
                  <h4 className="text-sm font-medium text-zinc-300 mb-2">Search Results:</h4>
                  <div className="space-y-4">
                    {visualSearchResults.map((result, index) => (
                      <div key={index} className="space-y-3">
                        <div className="flex items-start gap-3 text-sm">
                          <button
                            onClick={() => handleTimestampClick(result.timestamp)}
                            className="min-w-[60px] px-2 py-1 bg-zinc-800 rounded text-zinc-300 font-mono hover:bg-zinc-700 transition-colors"
                          >
                            {result.timestamp}
                          </button>
                          <span className="text-zinc-400">{result.description}</span>
                        </div>
                        {result.frameUrl && (
                          <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                            <Image 
                              src={result.frameUrl} 
                              alt="Video frame" 
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
