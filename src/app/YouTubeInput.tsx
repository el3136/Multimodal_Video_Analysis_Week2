"use client";

import { useState, useRef, useEffect } from "react";

interface Topic {
  timestamp: string;
  topic: string;
}

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, options: any) => any;
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
  const [transcript, setTranscript] = useState<any[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  // for video player
  const [videoId, setVideoId] = useState("");
  const playerRef = useRef<any>(null);

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
          onReady: (event: any) => {
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
      setAnswer(data.answer);
    } catch (error) {
      console.error("Chat error:", error);
    }
    setIsChatLoading(false);
  };

  const handleTimestampClick = (timestamp: string) => {
    if (!playerRef.current) return;

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

    // Seek to the timestamp
    playerRef.current.seekTo(totalSeconds, true);
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
          <div className="mt-8 space-y-4">
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
                <div className="space-y-2">
                  {(() => {
                    try {
                      const parsedAnswer = JSON.parse(answer);
                      if (Array.isArray(parsedAnswer)) {
                        return parsedAnswer.map((item, index) => (
                          <div key={index} className="text-zinc-400">
                            {item.answer}
                          </div>
                        ));
                      } else if (typeof parsedAnswer === 'object' && parsedAnswer.answer) {
                        return <div className="text-zinc-400">{parsedAnswer.answer}</div>;
                      }
                      return <div className="text-zinc-400">{answer}</div>;
                    } catch {
                      return <div className="text-zinc-400">{answer}</div>;
                    }
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
