import { useEffect, useState } from "react";
import api from "../utils/api";
import simpleChat from "../schemas/simpleChat.json" with { type: "json" };

export default function Home() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState<any>([]);
  const [input, setInput] = useState("");

  const fetchUserData = async () => {
    try {
      const response = await api.get("/user");
      setUser(response.data);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const handleSendMessage = async (prompt: string) => {
    const newMessages = [...messages, { role: "human", content: prompt }];
    setMessages(newMessages);

    try {
      const response = await api.post("/chat", { messages: newMessages, schema: simpleChat });
      const aiMessage = response.data[0];
      setMessages([...newMessages, { role: "ai", content: aiMessage }]);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  return (
    <div>
      <div>Home {user && <pre>{JSON.stringify(user, null, 2)}</pre>}</div>
      <div>
        Chat
        <input type="text" placeholder="Type your message..." value={input} onChange={(e) => setInput(e.target.value)} />
        <button onClick={() => handleSendMessage(input)}>Send</button>
        {
          messages.map((msg:string) => (
            msg?.role === 'human' ? (
              <div style={{ textAlign: 'right' }}>{msg?.content}</div>
            ) : (
              <div>
              <div style={{ textAlign: 'left' }}>{msg?.content.topic}</div>
              <div style={{ textAlign: 'left', fontStyle: 'italic' }}>{msg?.content.response}</div>
              <div style={{ textAlign: 'left', fontSize: 'small' }}>date: {msg?.content.date}</div>
              </div>
            )
          )
        )
        }
      </div>
    </div>
  );
}
