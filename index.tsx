import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";

// --- RITE SCHEME CONTEXT DATA (Extracted from PDF) ---
const PDF_CONTEXT = `
CONTEXT: Research Inspired Teaching Excellence Scheme (RITE) at Aston University.
GOAL: Support transformation of teaching culture through professional recognition (Senior Fellowship/SFHEA).
FRAMEWORK: Professional Standards Framework 2023 (PSF 2023).

DESCRIPTOR 3 (Senior Fellow) REQUIREMENTS:
- D3.1: A sustained record of leading or influencing the practice of those who teach/support high quality learning.
- D3.2: Practice that is effective, inclusive and integrates all Dimensions.
- D3.3: Practice that extends significantly beyond direct teaching and/or direct support for learning.

CRITICAL DISTINCTION:
- Descriptor 2 (Fellow): Focuses on direct work with learners/students.
- Descriptor 3 (Senior Fellow): Focuses on leading or influencing PEERS/COLLEAGUES.
- Trap: Applicants often write about their own teaching (D2) instead of how they influenced others (D3).

EVIDENCE EXAMPLES (D3):
- Mentoring colleagues (sustained, not one-off).
- Leading working groups/committees.
- Designing curriculum that others deliver.
- External examining/reviewing.
- Creating resources adopted by others.
- Leading interventions to boost student resilience involving a team.

APPLICATION STRUCTURE:
- Context Statement (300 words, not assessed).
- Reflective Narrative + 2 Case Studies (6,000 words total).
- 2 Supporting Statements from referees.

DIMENSIONS (Must be integrated):
- Values (V1-V5): Respect, Engagement, Scholarship (V3 is critical - evidence base), Wider Context, Collaboration.
- Core Knowledge (K1-K5): How learners learn, Approaches, Critical Eval, Digital Tech, QA.
- Areas of Activity (A1-A5): Design, Teach, Assess, Support, CPD.
`;

// --- MENTOR PERSONA INSTRUCTIONS ---
const SYSTEM_INSTRUCTION = `
${PDF_CONTEXT}

ROLE: You are an expert Digital Mentor for the RITE Scheme at Aston University.
OBJECTIVE: Assist the user with their Senior Fellowship application, focusing on developing Case Studies and understanding Descriptor 3.

STRICT ADHERENCE: You must ALWAYS follow the guidance provided in the RITE Scheme Context (PDF_CONTEXT) above. Do not deviate from the definitions of Descriptor 3.

PROTOCOL:
1. INTAKE: Listen to their input. They might propose a case study, upload a draft document, ask a question, or describe their general role.
2. ANALYSIS (Documents): If the user uploads a document (PDF/Text), analyze it specifically against Descriptor 3 criteria. Identify areas where they focus too much on "teaching students" (D2) and suggest how to pivot to "influencing colleagues" (D3).
3. STRESS TEST (CRITICAL) - IF they propose a topic:
   - If they describe ONLY working with students (e.g., "I taught a great module"), STOP them. Explain this is Fellow (D2) level. Ask: "How did you influence *colleagues* with this work? Did you mentor staff or lead the team?"
   - If they describe leading/influencing staff, PROCEED.
4. DEEP DIVE: Ask targeted questions to flesh out details (Who influenced? Evidence? Why/Scholarship?).
5. OUTLINE: Once you have enough info for a case study, generate a structured outline (Title, Context, Action, PSF Mapping, Impact).

TONE: Professional, supportive, collegiate, rigorous. Do not let D2 examples pass as D3.
START: Start by introducing yourself as the RITE Digital Mentor. State clearly that you are here to support their Senior Fellowship application. Explain that you can help brainstorm case studies, analyze uploaded drafts, or discuss their general leadership experience to find hidden gems. Invite them to share an idea or upload a document to begin.
`;

const ChatApp = () => {
  const [messages, setMessages] = useState<Array<{ role: "user" | "model"; text: string; file?: string }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Chat Session
  useEffect(() => {
    const initChat = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chat = ai.chats.create({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7,
          },
        });
        setChatSession(chat);

        // Get the opening message from the model
        setIsLoading(true);
        const response = await chat.sendMessage({ message: "Start the session now." });
        setMessages([{ role: "model", text: response.text }]);
        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing chat:", error);
        setMessages([
          { role: "model", text: "Error connecting to the RITE Digital Mentor service. Please check your API key." },
        ]);
      }
    };

    initChat();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Extract base64 data if it's a data URL
      const base64Data = result.split(",")[1];
      setAttachedFile({
        name: file.name,
        type: file.type,
        data: base64Data,
      });
    };
    reader.readAsDataURL(file);
    // Reset input value so same file can be selected again if needed
    e.target.value = "";
  };

  const removeAttachment = () => {
    setAttachedFile(null);
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || !chatSession) return;

    const userText = input;
    const currentFile = attachedFile;
    
    setInput("");
    setAttachedFile(null);

    // Add user message to UI
    setMessages((prev) => [
      ...prev,
      { 
        role: "user", 
        text: userText || (currentFile ? `[Uploaded File: ${currentFile.name}]` : ""),
        file: currentFile?.name
      }
    ]);
    
    setIsLoading(true);

    try {
      let result;
      
      if (currentFile) {
        // Send file + text
        const parts: any[] = [];
        
        // Add file part
        parts.push({
          inlineData: {
            mimeType: currentFile.type,
            data: currentFile.data
          }
        });

        // Add text part if exists, otherwise add a default prompt to analyze the file
        if (userText.trim()) {
          parts.push({ text: userText });
        } else {
          parts.push({ text: "Please analyze this document for Senior Fellowship (Descriptor 3) evidence." });
        }

        // We use sendMessage on the chat session, but we need to pass parts for multimodal
        result = await chatSession.sendMessage({ parts: parts });

      } else {
        // Text only
        result = await chatSession.sendMessage({ message: userText });
      }

      const responseText = result.text;
      setMessages((prev) => [...prev, { role: "model", text: responseText }]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "I encountered an error processing your request. Please ensure the file type is supported (PDF or Text) and try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <header
        style={{
          background: "linear-gradient(135deg, var(--aston-purple) 0%, var(--aston-magenta) 100%)",
          color: "white",
          padding: "20px 30px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "600" }}>RITE Scheme</h1>
          <p style={{ margin: "5px 0 0", opacity: 0.9, fontSize: "0.9rem" }}>
            Senior Fellowship (D3) Digital Mentor
          </p>
        </div>
        <div style={{ textAlign: "right", fontSize: "0.8rem", opacity: 0.8 }}>
          Aston University
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* Sidebar (Desktop only) */}
        <aside
          style={{
            width: "300px",
            background: "var(--bg-color)",
            borderRight: "1px solid #e0e0e0",
            padding: "20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            // Responsive visibility handled by media query
          }}
          className="sidebar"
        >
          <style>{`
            .sidebar { display: none; }
            @media (min-width: 768px) {
              .sidebar { display: flex !important; }
            }
          `}</style>
          
          <div>
            <h3 style={{ color: "var(--aston-purple)", marginTop: 0 }}>Quick Reference</h3>
            
            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ fontSize: "0.9rem", color: "#666" }}>What is Descriptor 3?</h4>
              <p style={{ fontSize: "0.85rem", lineHeight: "1.4" }}>
                Comprehensive understanding and effective practice that provides a basis from which you 
                <strong> lead or influence</strong> those who teach and/or support high-quality learning.
              </p>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ fontSize: "0.9rem", color: "#666" }}>The "Trap" to Avoid</h4>
              <p style={{ fontSize: "0.85rem", lineHeight: "1.4", background: "#fff0f0", padding: "10px", borderRadius: "5px", borderLeft: "3px solid red" }}>
                Focusing on your own teaching excellence (D2) rather than how you influenced your colleagues (D3).
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: "0.9rem", color: "#666" }}>Key Criteria</h4>
              <ul style={{ fontSize: "0.85rem", paddingLeft: "20px", lineHeight: "1.4" }}>
                <li><strong>D3.1:</strong> Sustained record of leading/influencing.</li>
                <li><strong>D3.2:</strong> Effective, inclusive practice integrating Dimensions.</li>
                <li><strong>D3.3:</strong> Extending significantly beyond direct teaching.</li>
              </ul>
            </div>
          </div>

          <div style={{ marginTop: "auto", borderTop: "1px solid #ddd", paddingTop: "15px" }}>
            <h4 style={{ fontSize: "0.8rem", color: "var(--aston-magenta)", textTransform: "uppercase" }}>Disclaimer</h4>
            <p style={{ fontSize: "0.75rem", color: "#666", lineHeight: "1.4", fontStyle: "italic" }}>
              This tool is for brainstorming and developing ideas. The advice provided here is AI-generated and should be checked with an official Aston University RITE mentor. The guidance in the uploaded documents is always followed by this tool.
            </p>
          </div>
        </aside>

        {/* Chat Area */}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--chat-bg)",
            position: "relative",
          }}
        >
          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  alignItems: "flex-end",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "15px 20px",
                    borderRadius: "15px",
                    borderBottomLeftRadius: msg.role === "model" ? "0" : "15px",
                    borderBottomRightRadius: msg.role === "user" ? "0" : "15px",
                    backgroundColor: msg.role === "user" ? "var(--user-msg-bg)" : "var(--ai-msg-bg)",
                    color: msg.role === "user" ? "white" : "var(--text-color)",
                    lineHeight: "1.5",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.role === "model" && (
                    <div style={{ fontWeight: "bold", marginBottom: "5px", fontSize: "0.8rem", color: "var(--aston-purple)" }}>
                      RITE Digital Mentor
                    </div>
                  )}
                  {msg.file && (
                    <div style={{ 
                      backgroundColor: "rgba(255,255,255,0.2)", 
                      padding: "5px 10px", 
                      borderRadius: "5px", 
                      marginBottom: "5px",
                      fontSize: "0.85rem",
                      display: "inline-block"
                    }}>
                      📄 {msg.file}
                    </div>
                  )}
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ alignSelf: "flex-start", marginLeft: "10px", color: "#888", fontStyle: "italic" }}>
                RITE Digital Mentor is analyzing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: "20px",
              backgroundColor: "white",
              borderTop: "1px solid #eee",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {attachedFile && (
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "10px", 
                backgroundColor: "#f0f0f0", 
                padding: "8px 12px", 
                borderRadius: "8px",
                width: "fit-content"
              }}>
                <span style={{ fontSize: "1.2rem" }}>📄</span>
                <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{attachedFile.name}</span>
                <button 
                  onClick={removeAttachment}
                  style={{ 
                    background: "none", 
                    border: "none", 
                    cursor: "pointer", 
                    color: "#666",
                    fontSize: "1rem",
                    padding: "0 5px" 
                  }}
                >
                  ✕
                </button>
              </div>
            )}
            
            <div style={{ display: "flex", gap: "10px" }}>
              <input 
                type="file" 
                accept=".pdf,.txt"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload PDF or Text document"
                style={{
                  backgroundColor: "#f0f0f0",
                  color: "#555",
                  border: "1px solid #ddd",
                  borderRadius: "10px",
                  padding: "0 15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem"
                }}
              >
                📎
              </button>
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message here or upload a draft for review..."
                style={{
                  flex: 1,
                  padding: "15px",
                  borderRadius: "10px",
                  border: "1px solid #ddd",
                  resize: "none",
                  height: "60px",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !attachedFile)}
                style={{
                  backgroundColor: "var(--aston-magenta)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  padding: "0 25px",
                  cursor: isLoading || (!input.trim() && !attachedFile) ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                  transition: "background 0.2s",
                  opacity: isLoading || (!input.trim() && !attachedFile) ? 0.6 : 1,
                }}
              >
                Send
              </button>
            </div>
            {/* Mobile Disclaimer */}
            <div style={{ display: "block", fontSize: "0.7rem", color: "#999", textAlign: "center", fontStyle: "italic" }}>
              Disclaimer: This tool is for brainstorming. Always check advice with an official RITE mentor.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<ChatApp />);