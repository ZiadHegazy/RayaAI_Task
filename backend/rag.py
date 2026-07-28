from langchain_community.embeddings import OllamaEmbeddings
from langchain_postgres import PGVector
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
import os
from obs_logger import obs_log

OLLAMA_URL = os.getenv("OLLAMA_BASE_URL")
embeddings = OllamaEmbeddings(model="nomic-embed-text", base_url=OLLAMA_URL)

# Initialize PGVector store
vector_store = PGVector(
    embeddings=embeddings,
    connection=os.getenv("DATABASE_URL").replace("+asyncpg", "+psycopg"), # pgvector needs sync driver for some ops
    collection_name="telecom_docs",
    use_jsonb=True,
)

def process_and_store_pdf(file_path: str, source_name: str = None):
    loader = PyPDFLoader(file_path)

    docs = loader.load()
    print(docs)
    if source_name:
        for doc in docs:
            doc.metadata['source'] = source_name
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents(docs)
    vector_store.add_documents(chunks)

def process_and_store_text(content: str, source_name: str):
    doc = Document(page_content=content, metadata={"source": source_name})
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents([doc])
    vector_store.add_documents(chunks)

def clear_knowledge_base():
    vector_store.delete_collection()
    vector_store.create_collection()

from langchain_core.tools import tool

@tool
def retrieve_context(query: str) -> str:
    """Searches the Telecom knowledge base for policies, FAQs, and company information. ALWAYS cite the source when using this info."""
    obs_log("rag", "RAG_QUERY", {"query": query})
    try:
        # We use cosine distance, where lower score is closer/more relevant
        docs_with_scores = vector_store.similarity_search_with_score(query, k=3)
        
        # Log each result with its score and whether it passed the threshold
        obs_log("rag", "RAG_SCORES", {
            "results": [
                {
                    "source": doc.metadata.get("source", "Unknown"),
                    "score": round(float(score), 4),
                    "passed": score <= 0.5,
                }
                for doc, score in docs_with_scores
            ]
        })

        # Filter results above a distance threshold (0.5 for cosine)
        # Note: this threshold should be tuned against real embeddings in production
        filtered_docs = [doc for doc, score in docs_with_scores if score <= 0.5]
        
        if not filtered_docs:
            obs_log("rag", "RAG_RESULT", {"docs_returned": 0, "reason": "all results above threshold"})
            return "No relevant documents found in the knowledge base."

        obs_log("rag", "RAG_RESULT", {"docs_returned": len(filtered_docs), "sources": [d.metadata.get("source") for d in filtered_docs]})
        return "\n\n".join([f"[Source: {doc.metadata.get('source', 'Unknown')}]\n{doc.page_content}" for doc in filtered_docs])
    except Exception as e:
        obs_log("rag", "RAG_ERROR", {"error": str(e)})
        return f"Error connecting to knowledge base: {str(e)}"