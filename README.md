# Telecom AI Agent POC

This is a proof-of-concept for an AI-powered Telecom Assistant built with FastAPI, LangGraph, Ollama (Qwen 2.5), PGVector, and React. It features a conversational AI for customers and a robust dashboard for administrators.

## 🚀 How to Run the App

The application runs entirely within Docker and uses local AI models via Ollama. You can run the application in either CPU or GPU mode depending on your hardware.

### Option A: CPU-Only Mode (Universal, Recommended for Laptops)
If you do not have an NVIDIA GPU or the NVIDIA Container Toolkit installed, run the CPU-only configuration:
```bash
docker compose -f docker-compose.cpu.yml up -d --build
```

### Option B: GPU Accelerated Mode (NVIDIA GPUs only)
If you have an NVIDIA GPU configured with Docker, you can run the GPU configuration for significantly faster AI response times:
```bash
docker compose -f docker-compose.gpu.yml up -d --build
```

*Note: On the first launch, it will take several minutes to download the PostgreSQL, Ollama, and Langfuse images, as well as the `qwen2.5:7b` and `nomic-embed-text` models.*

---

## 🔑 Accounts and Access

Once the containers are running, you can access the frontend application at: **http://localhost:3001**

### Customer/User Login
- **Username:** `user1` (or `user2`)
- **Password:** `password`

### Administrator Login
- **Username:** `admin`
- **Password:** `password`

---

## 📱 User Features

When logged in as a customer, you can interact with the AI assistant to get support.
- **Conversational Support**: Ask questions about telecom packages, policies, or troubleshooting.
- **Context-Aware Memory**: The AI remembers your conversation history within the session.
- **Tool Execution**: The AI can perform tasks on your behalf (e.g., retrieving your specific data balance, looking up your current package).
- **Confirmation Handling**: If you request an action that modifies your account (like changing a data package), the AI will present a confirmation prompt in the UI before proceeding.

---

## 🛠️ Admin Features

When logged in as an administrator, you gain access to the **Admin Dashboard** which provides oversight and control over the platform.

- **Knowledge Base Management (RAG)**: 
  - **Upload PDFs**: Directly upload documents (like policy PDFs) and assign them a source name. They are instantly vectorized and added to the AI's knowledge base.
  - **Add Text Snippets**: Paste plain text directly into the system to teach the AI new rules or temporary promotions.
  - **Clear KB**: A fail-safe button to safely empty the entire vector collection if you need to start fresh.
- **Customer Overview**: View all registered customers, their active packages, and data balances in a clean table.
- **Support Tickets**: Monitor ongoing and resolved support tickets submitted by customers.
- **Orchestration Logs (Observability)**: View real-time, persistent logs of the AI's internal thought process. You can see when the AI enters a reasoning node, decides to call a tool, queries the RAG database, or routes the conversation.
  - Click the **Legend** button to see what different color-coded events mean.
  - Click **Clear Logs** to purge the orchestration database.

---

## 🔍 Setting Up Langfuse (Observability)

Langfuse provides deep tracing for the LLM chains. It runs locally alongside the app at **http://localhost:3000**.

Because this is a pre-configured Proof of Concept, **Langfuse has been automatically seeded** with the necessary API keys and project settings during the Docker startup phase. 

You do not need to configure any API keys! Just log in to view the traces:
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Log in with the pre-seeded credentials:
   - **Email:** `admin@telecom.com`
   - **Password:** `password`
3. Click on the **telecom-poc** project to view real-time execution traces, model latency, token usage, and retrieval scores for every interaction the AI has with the users.
