from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI
from langchain_openai import OpenAIEmbeddings
from langchain_community.document_loaders import YoutubeLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone
import tiktoken
import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pinecone_api_key = os.getenv("PINECONE_API_KEY")
openai_api_key = os.getenv("OPENAI_API_KEY")
openrouter_api_key = os.getenv("OPENROUTER_API_KEY")

embeddings = OpenAIEmbeddings()
embed_model = "text-embedding-3-small"
openai_client = OpenAI()

openrouter_client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key=openrouter_api_key
)

class PerformRAGRequest(BaseModel):
    youtube_url: str
    query: str

@app.post("/perform_rag/")
async def perform_rag_endpoint(request: PerformRAGRequest):
    try:
        result = await perform_rag(
            youtube_url=request.youtube_url,
            query=request.query,
            pinecone_api_key=pinecone_api_key,
            openai_client=openai_client
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def perform_rag(youtube_url, query, pinecone_api_key, openai_client):
    tokenizer = tiktoken.get_encoding('p50k_base')

    def tiktoken_len(text):
        tokens = tokenizer.encode(text, disallowed_special=())
        return len(tokens)

    loader = YoutubeLoader.from_youtube_url(youtube_url, add_video_info=True)
    data = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000,
        chunk_overlap=100,
        length_function=tiktoken_len,
        separators=["\n\n", "\n", " ", ""]
    )
    
    texts = text_splitter.split_documents(data)
    
    index_name = 'youtube'
    namespace = 'youtube_video'
    
    vectorstore = PineconeVectorStore(index_name=index_name, embedding=embeddings)
    pc = Pinecone(api_key=pinecone_api_key)
    pinecone_index = pc.Index(index_name)

    video_id = youtube_url.split('v=')[-1]
    
    existing_vector = pinecone_index.query(vector=[0]*1536, top_k=1, filter={"metadata.source": youtube_url}, namespace=namespace)
    
    if existing_vector['matches']:
        print("Video already exists in Pinecone. Skipping vectorization.")
    else:
        vectorstore_from_texts = PineconeVectorStore.from_texts(
            [f"Source: {t.metadata['source']}, Title: {t.metadata['title']} \n\nContent: {t.page_content}" for t in texts], 
            embeddings, 
            index_name=index_name, 
            namespace=namespace,
            ids=[f"{video_id}_{i}" for i in range(len(texts))]
        )
    
    raw_query_embedding = openai_client.embeddings.create(
        input=query,
        model="text-embedding-3-small"
    )

    query_embedding = raw_query_embedding.data[0].embedding
    
    top_matches = pinecone_index.query(vector=query_embedding, top_k=10, include_metadata=True, namespace=namespace)
    
    contexts = [item['metadata']['text'] for item in top_matches['matches']]
    
    augmented_query = "<CONTEXT>\n" + "\n\n-------\n\n".join(contexts[:10]) + "\n-------\n</CONTEXT>\n\n\n\nMY QUESTION:\n" + query
    
    system_prompt = f"""You are a professional researcher. Use the youtube video to answer any questions."""
    
    res = openrouter_client.chat.completions.create(
        model="google/gemma-2-9b-it:free",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": augmented_query}
        ]
    )
    
    return res.choices[0].message.content