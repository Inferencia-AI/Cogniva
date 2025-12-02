from fastapi import FastAPI
from src.routes.chat.get import get_chat
from src.utils.sentence_transformer_utils.main import retrieve

app = FastAPI()

@app.get("/") 
def read_root():
    return {"Hello": "World"}
@app.get("/chat/{id}")
def read_chat(id: int):
    return get_chat(id)
@app.get("/retrieve/")
def retrieve_endpoint():
    query = "France"
    results = retrieve(query, top_k=1).get("text")
    return {"results": results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)