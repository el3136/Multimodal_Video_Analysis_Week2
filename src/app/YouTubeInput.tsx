"use client";

import { useState } from "react";

interface Topic {
  timestamp: string;
  topic: string;
}

export function YouTubeInput() {
  const [videoUrl, setVideoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
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
          {/* <p className="text-zinc-400">{summary}</p> */}
          {isLoading? "Analyzing" :  "Analyze Video"}
        </button>
        {/* loading spinner */}
        {isLoading && (
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600" />
          </div>
        )}
        {/* topics timeline */}
        {topics.length > 0 && (
          <div className="mt-4 p-4 bg-zinc-900 rounded-lg">
            <h3 className="text-lg font-semibold text-zinc-300 mb-2">
              Video Topics Timeline
            </h3>
            <div className="space-y-3">
              {topics.map((item, index) => (
                <div key={index} className="flex items-start gap-3 text-sm">
                  <span className="min-w-[60px] px-2 py-1 bg-zinc-800 rounded text-zinc-300 font-mono">
                    {item.timestamp}
                  </span>
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
                <p className="text-zinc-400 whitespace-pre-wrap">{answer}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
