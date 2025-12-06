import { useEffect, useState } from "react";
import api from "../utils/api";
import simpleChat from "../schemas/simpleChat.json" with { type: "json" };
import codeChat from "../schemas/codeChatSchema.json" with { type: "json" };
import { MessageCircleCodeIcon, Mic2Icon, SendIcon, SidebarClose, SidebarOpenIcon } from 'lucide-react'
import { getIdToken, signOut } from "firebase/auth";
import { auth } from "../utils/firebaseClient";
import { CodeBlock } from 'react-code-block';


export default function Home() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState<any>([]);
  const [chats, setChats] = useState<any>([]);
  const [selectedChat, setSelectedChat] = useState<number | undefined>(undefined);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleProfileMenu = () => {
    setProfileMenuOpen(!profileMenuOpen);
  }

  const fetchUserData = async () => {
    try {
      const response = await api.get("/user");
      setUser(response.data);
    } catch (error) {
      console.error("Error fetching user data:", error);
      const newToken = await getIdToken(auth.currentUser!, true);
      localStorage.setItem("token", newToken);
      window.location.reload();
    }
  };

  const fetchChats = async () => {
    try {
      //@ts-ignore
      const uid = user.user.uid;
      const response = await api.get(`/chats/${uid}`);
      setChats(response.data);
    } catch (error) {
      console.error("Error fetching chat history:", error);
    }
  }

  const handleChatClick = (chat: any) => {
    setMessages(chat.messages);
    setSelectedChat(chat.id);
  };

  const handleNewChat = () => {
    setMessages([]);
    setSelectedChat(undefined);
  }

  const handleSendMessage = async (prompt: string) => {
    const newMessages = [...messages, { role: "human", content: prompt }];
    setMessages(newMessages);
    
    try {
      const response = await api.post("/chat", { messages: newMessages, schema: [simpleChat, codeChat] });
      const aiPayload = Array.isArray(response.data) ? response.data.flat() : [response.data];
      setMessages([...newMessages, { role: "ai", content: aiPayload }]);
      const savedChat = await api.post("/save-chat", {userId: user?.user?.uid, messages: [...newMessages, { role: "ai", content: aiPayload }], chatId: selectedChat})
      if (!selectedChat) {
        setChats([...chats, savedChat.data[0]]);
        setSelectedChat(savedChat.data[0].id);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };
  
  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (user) {
      fetchChats();
    }
  }, [user]);
  

  return (
    <div className="flex flex-col bg-primary h-full overflow-hidden">
      <div className="flex p-default items-center justify-between border-b border-accent shadow-md">
        {/* header */}
        <div className="flex items-center gap-default">
          <img onClick={toggleProfileMenu} src={user?.user.picture} className="rounded-full size-12" alt="User Avatar" />
          <div className="sm:block hidden">
            <p className="text-default text-body">{user?.user.name}</p>
            <p className="text-default text-caption">{user?.user.email}</p>
          </div>

          <div className={`transition-all duration-300 ${profileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} absolute top-16 left-4 bg-secondary shadow-md rounded-md flex flex-col gap-default`}>
            <button className="button" onClick={() => {
              signOut(auth).then(() => {
                localStorage.removeItem("token");
                window.location.href = "/";
              });
            }}>Sign Out</button>
          </div>

        </div>

        <img src="/cogniva-landscape-logo.svg" className="h-20" alt="Cogniva Logo" />
      </div>

      <div className="flex flex-col gap-default p-default h-full">
        <div onClick={toggleSidebar}>
          {
            sidebarOpen ? <SidebarClose className="text-accent bg-secondary size-8 rounded-md" /> :
              <SidebarOpenIcon className="text-accent bg-secondary size-8 rounded-md" />
          }
        </div>
        <div className="flex gap-default h-full">
          {/* sidebar and main content */}
          <div className={`transition-all duration-300 ${sidebarOpen ? 'sm:w-64 w-full' : 'w-0 overflow-hidden opacity-0'} h-full`}>
            {/* sidebar */}
            <button className="button w-full text-default" >+ New Chat</button>
            <hr className="border-accent my-default" />
            <div className="overflow-y-auto h-full">
              {/* Chat history would go here */}
              {
                chats.length > 0 ? chats.map((chat: any, index: number) => (
                  <div key={index} className="p-small hover:bg-accent rounded-md cursor-pointer">
                    <button
                    onClick={()=> handleChatClick(chat)}
                    className="button !bg-secondary/20 w-full">{chat?.messages[0]?.content}...</button>
                  </div>
                )) :
                  <p className="text-default text-body p-default text-center">No previous chats.</p>
              }
            </div>
          </div>
          <div className={`transition-all duration-300 ${sidebarOpen ? 'sm:w-[calc(100%-16rem)] w-0' : 'w-full'} relative`}>
            {/* main content */}
            <div className="flex flex-col h-[90%] overflow-y-auto absolute top-0 left-0 right-0">
              {messages.length > 0 ? messages.map((msg: any, index: number) => {
                if (msg?.role === "human") {
                  return (
                    <div key={`msg-${index}`} className="bg-secondary/10 p-default rounded-md mb-default">
                      {msg?.content}
                    </div>
                  );
                }

                const aiSections = Array.isArray(msg?.content) ? msg.content : [msg?.content];

                return (
                  <div key={`msg-${index}`} className="flex flex-col gap-default mb-default">
                    {aiSections?.filter(Boolean)?.map((section: any, sectionIndex: number) => {
                      const isStructuredResponse = Array.isArray(section?.response);
                      const hasCodeFence = typeof section?.response === "string" && section?.response.includes("```");

                      return (
                        <div key={`section-${sectionIndex}`} className="mt-auto p-default flex flex-col gap-small">
                          <p className="text-heading">{section?.topic}</p>

                          {isStructuredResponse ? (
                            <div className="flex flex-col gap-small">
                              {section?.response?.map((snippet: any, snippetIndex: number) => {
                                const snippetLanguage = typeof snippet?.language === "string" ? snippet.language.toLowerCase() : "text";

                                return (
                                  <div key={`snippet-${snippetIndex}`} className="p-small flex flex-col gap-1">
                                    {snippet?.text ? <p className="text-body font-semibold">{snippet.text}</p> : null}
                                    <CodeBlock
                                      code={snippet?.code || ""}
                                      language={snippetLanguage}
                                    >
                                      <CodeBlock.Code className="overflow-auto">
                                        <CodeBlock.LineContent>
                                          <CodeBlock.Token />
                                        </CodeBlock.LineContent>
                                      </CodeBlock.Code>
                                    </CodeBlock>
                                  </div>
                                );
                              })}
                            </div>
                          ) : hasCodeFence ? (
                            section?.response
                              ?.split("```")
                              .filter((_: any, i: any) => i % 2 === 1)
                              ?.map((codeSegment: string, i: number) => (
                                <CodeBlock
                                  key={i}
                                  code={`${codeSegment?.replace(/^[a-zA-Z]+\n/, "")}`}
                                  language="js"
                                >
                                  <CodeBlock.Code className="overflow-auto">
                                    <CodeBlock.LineContent>
                                      <CodeBlock.Token />
                                    </CodeBlock.LineContent>
                                  </CodeBlock.Code>
                                </CodeBlock>
                              ))
                          ) : (
                            <p className="text-body whitespace-pre-line"> {section?.response} </p>
                          )}

                          {section?.date ? <p className="text-caption"> {section?.date} </p> : null}
                        </div>
                      );
                    })}
                  </div>
                );
              }):(
                <div className="flex-1 flex flex-col justify-center items-center">
                  <p className="text-default text-heading">Welcome to Cogniva Chat!</p>
                  <p className="text-default/50 text-body">Start a new chat by typing a message below.</p>
                </div>
              )  
            }
            </div>
            <div className={`h-[8%] shadow-md border-accent rounded-md border absolute ${sidebarOpen ? "bottom-0" : "bottom-8"} left-0 right-0`}>
              <div className="p-default gap-default bg-secondary/50 rounded-md flex gap-small items-center h-full justify-between">
                <MessageCircleCodeIcon className="text-accent" />
                <input
                  type="text"
                  className="flex-1 text-default outline-none"
                  placeholder="Type your message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && input.trim() !== "") {
                      handleSendMessage(input.trim());
                      setInput("");
                    }
                  }}
                />
                <div className="flex gap-default">
                <button className="button" onClick={() => {
                  if (input.trim() !== "") {
                    handleSendMessage(input.trim());
                    setInput("");
                  }
                }}>
                  <SendIcon className="text-accent" />
                </button>
                <button className="button" onClick={()=>{}}>
                  <Mic2Icon className="text-accent" />
                </button>
                </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
