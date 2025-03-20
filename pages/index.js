import { useState, useEffect, useRef } from "react";
import "../styles/Home.css";

function Home() {
  const [selectedCourse, setSelectedCourse] = useState(null);

  return (
    <div className="container">
      {!selectedCourse ? (
        <div className="homepage-container">
          <h1>Featured Courses</h1>
          <div className="courses">
            <div className="course-card" onClick={() => setSelectedCourse("Basic English (A1-A2)")}>
              <h2>Basic English (A1-A2)</h2>
              <p>Ideal pentru începători. Exersează expresii uzuale și gramatică de bază.</p>
              <button>More</button>
            </div>
            <div className="course-card" onClick={() => setSelectedCourse("Medium English (B1-B2)")}>
              <h2>Medium English (B1-B2)</h2>
              <p>Dezvoltă-ți fluența și participă la conversații mai complexe.</p>
              <button>More</button>
            </div>
            <div className="course-card" onClick={() => setSelectedCourse("Advanced English (C1-C2)")}>
              <h2>Advanced English (C1-C2)</h2>
              <p>Învață să comunici fluent și să înțelegi texte avansate.</p>
              <button>More</button>
            </div>
          </div>
        </div>
      ) : (
        <Chat course={selectedCourse} goBack={() => setSelectedCourse(null)} />
      )}
    </div>
  );
}

function Chat({ course, goBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingTranslation, setAwaitingTranslation] = useState(true);
  const [feedbacks, setFeedbacks] = useState([]); // feedback-uri agregate
  const [report, setReport] = useState("");
  const [showReport, setShowReport] = useState(false);

  const messagesEndRef = useRef(null);
  const firstMessageRef = useRef(false);

  useEffect(() => {
    if (!firstMessageRef.current) {
      generateNewSentence();
      firstMessageRef.current = true;
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showReport]);

  const generateNewSentence = async () => {
    setLoading(true);
    setAwaitingTranslation(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course }),
      });
      const data = await res.json();
      if (data.reply && data.reply.content) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply.content }]);
      }
    } catch (error) {
      console.error("Error:", error);
    }
    setLoading(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });
      const data = await res.json();
      if (data.reply && data.reply.content) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply.content }]);
        setAwaitingTranslation(false);
        console.log("Raw Feedback:", data.reply.rawFeedback);
        if (data.reply.rawFeedback && data.reply.rawFeedback.trim() !== "") {
          setFeedbacks(prev => [...prev, data.reply.rawFeedback.trim()]);
        }
      }
    } catch (error) {
      console.error("Error:", error);
    }
    setLoading(false);
  };

  const generateReport = async () => {
    const aggregatedFeedback = feedbacks.join("\n");
    if (!aggregatedFeedback) return;

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aggregatedFeedback }),
      });
      const data = await res.json();
      if (data.report) {
        setReport(data.report);
        setShowReport(true);
      }
    } catch (error) {
      console.error("Error generating report:", error);
    }
  };

  const closeReport = () => {
    setShowReport(false);
  };

  return (
    <div className="chat-container">
      <button onClick={goBack} className="back-button">← Back</button>
      <h1>{course} Chat</h1>
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={msg.role === "user" ? "message user" : "message assistant"}>
            <div dangerouslySetInnerHTML={{ __html: msg.content }} />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {awaitingTranslation ? (
        <form onSubmit={handleSend} className="input-area">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter your translation..." />
          <button type="submit" disabled={loading}>{loading ? "Waiting..." : "Send"}</button>
        </form>
      ) : (
        <>
          <button className="neutral-button" onClick={generateNewSentence} disabled={loading}>
            Următoarea frază
          </button>
          <button className="neutral-button" onClick={generateReport} disabled={loading}>
            Raport
          </button>
        </>
      )}
      {showReport && (
        <div className="report-container">
          <div className="report-content">
            <button className="close-button" onClick={closeReport}>X</button>
            <div dangerouslySetInnerHTML={{ __html: report }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
