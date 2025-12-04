import { ChatOllama } from "@langchain/ollama";
//@ts-ignore
import extractJson from "extract-json-from-string";

const llm = new ChatOllama({
    model: "gpt-oss:20b-cloud",
    baseUrl: "https://ollama.com",
    headers: {
        "Authorization": `Bearer ${process?.env?.OLLAMA_API_KEY}`,
    }
})

export async function invokeLLM(messages: { role: "human" | "system" | "ai" | "tool"; content: string; }[], schema: object = { "response": "string" }) {
    try {
        const defaultSystemPrompt = { "role": "system", "content": "You are a helpful assistant. you always output in json. You follow this schema: " + JSON.stringify(schema) }
        messages = messages.map(msg => {
            if (msg.role === "ai") {
                return { ...msg, content: JSON.stringify(msg.content) };
            }
            return msg;
        });
        const response = await llm.invoke([ defaultSystemPrompt, ...messages]);
        const responseText = response.content || "";
        const jsonData = extractJson(responseText);
        return jsonData ? jsonData : { text: responseText };
    } catch (error) {
        console.error("Error generating Ollama response:", error);
        throw error;
    }
}