from sentence_transformers import SentenceTransformer, util
import pandas as pd

model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

df = pd.read_csv("data.csv")
texts = df["text"].astype(str).tolist()

embeddings = model.encode(texts, convert_to_tensor=True)

def retrieve(query, top_k=1):
    q_emb = model.encode(query, convert_to_tensor=True)
    scores = util.cos_sim(q_emb, embeddings)[0]
    best_idx = scores.topk(k=top_k).indices.tolist()
    return df.iloc[best_idx]

if __name__ == "__main__":
    query = "France"
    results = retrieve(query, top_k=1).get("text")
    print(results)

    
