# Inferancia Chat (Backend)
A Rag based Chat Agent that can answer questions based on your own documents & integrated knowledge bases.
## Features
- 🔐 Authentication
- 📄 Document Upload
- 🌐 Web Search
- ⚙️ API Access
- 🤖 Chat with your documents
- 🧠 Chat with our knowledge bases
## Technologies Used
- **Flask**: A Backend web framework for Python.
- **Langchain**: A framework for developing applications powered by language models.
- **Langgraph**: A framework for building applications with LLMs through composable components.
- **Cerebras**: An Inference provider for hosting large language models.
- **Supabase**: An open-source Firebase alternative for Normal & Vector database purpose and authentication and user data + knowledge bases.
## Routes
### GET
- `/` : Health Check
- `/login` : Login Route
- `/register` : Register Route
- `/user` : Get User Info
- `/user/documents/:id` : Get User Documents
- `/knowledge-bases/:id` : Get Knowledge Base by ID
- `/user/chat/:id` : Get User Chat History
### POST
- `/login` : Login Route
- `/register` : Register Route
- `/upload` : Upload Document
- `/knowledge-bases` : Create Knowledge Base
- `/user/chat` : Create Chat Message
### DELETE
- `/user/documents/:id` : Delete User Document
- `/knowledge-bases/:id` : Delete Knowledge Base
- `/user/chat/:id` : Delete Chat Message