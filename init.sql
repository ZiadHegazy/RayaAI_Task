CREATE EXTENSION IF NOT EXISTS vector;

-- Users & Auth
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'customer', -- 'customer' or 'admin'
    customer_id INT UNIQUE
);

-- Mock Telecom Business Data
CREATE TABLE customer_data (
    customer_id INT PRIMARY KEY,
    package_name VARCHAR(50),
    data_balance_gb FLOAT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Chat History
CREATE TABLE chat_history (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    role VARCHAR(20), -- 'user' or 'assistant'
    content TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Support Tickets
CREATE TABLE support_tickets (
    ticket_id VARCHAR(20) PRIMARY KEY,
    customer_id INT REFERENCES customer_data(customer_id),
    issue_description TEXT,
    status VARCHAR(20) DEFAULT 'Open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vector Store for RAG
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    content TEXT,
    metadata JSONB,
    embedding vector(768) -- nomic-embed-text dimension
);

-- Observability Logs
CREATE TABLE orchestration_logs (
    request_id VARCHAR(50) PRIMARY KEY,
    started_at TIMESTAMP,
    duration_ms INT,
    trace_data JSONB
);

-- Seed Data
INSERT INTO users (username, password_hash, role, customer_id) VALUES 
('user1', 'password', 'customer', 101), -- password: password
('user2', 'password', 'customer', 102), -- password: password
('admin', 'password', 'admin', NULL);

INSERT INTO customer_data (customer_id, package_name, data_balance_gb) VALUES 
(101, 'Basic 10GB', 4.5),
(102,'Ultra 50GB',45.0);