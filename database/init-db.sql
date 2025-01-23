-- Create user if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'myuser') THEN
        CREATE USER myuser WITH PASSWORD 'mypassword';
    END IF;
END $$;

-- Create database if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_database WHERE datname = 'mydatabase') THEN
        CREATE DATABASE mydatabase;
    END IF;
END $$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE mydatabase TO myuser;
ALTER USER myuser WITH SUPERUSER;

-- Connect to the database
\c mydatabase myuser;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS search_terms;
DROP TABLE IF EXISTS news_articles;
DROP TABLE IF EXISTS entity_mentions;
DROP TABLE IF EXISTS analytics_cache;
DROP TABLE IF EXISTS scraping_results;

-- Create users table with role
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create chat_messages table
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create scraping_results table
CREATE TABLE scraping_results (
    id SERIAL PRIMARY KEY,
    source VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    analysis JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create search_terms table
CREATE TABLE search_terms (
    id SERIAL PRIMARY KEY,
    term VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'person', 'company', 'investment', 'general'
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create news_articles table
CREATE TABLE news_articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    source VARCHAR(100),
    published_at TIMESTAMP WITH TIME ZONE,
    content TEXT,
    sentiment_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create entity_mentions table
CREATE TABLE entity_mentions (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES news_articles(id) ON DELETE CASCADE,
    entity_name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'person', 'company', 'investment'
    context TEXT,
    sentiment_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create analytics_cache table for storing processed insights
CREATE TABLE analytics_cache (
    id SERIAL PRIMARY KEY,
    analysis_type VARCHAR(100) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE
);

-- Insert default admin user with password: Admin123!
-- Password hash generated using bcrypt with 10 rounds
INSERT INTO users (username, email, password, role)
VALUES (
    'Admin',
    'admin@trumpticker.com',
    '$2a$10$T7PXpT3zTKXhO.EGFm/SWufSckpXMkvEQkBUx4wFAD0SYQySwhQXO',
    'admin'
);

-- Insert test users with password: Admin123!
INSERT INTO users (username, email, password, role)
VALUES 
    ('Tester1', 'tester1@test.com', '$2a$10$T7PXpT3zTKXhO.EGFm/SWufSckpXMkvEQkBUx4wFAD0SYQySwhQXO', 'user'),
    ('Tester2', 'tester2@test.com', '$2a$10$T7PXpT3zTKXhO.EGFm/SWufSckpXMkvEQkBUx4wFAD0SYQySwhQXO', 'user');

-- Insert some test chat messages
INSERT INTO chat_messages (user_id, message)
SELECT id, 'Hello, this is a test message from ' || username
FROM users;

-- Insert some default search terms
INSERT INTO search_terms (term, category, created_by) 
SELECT 'Donald Trump', 'person', id 
FROM users WHERE username = 'Admin';

-- Grant all privileges on all tables to myuser
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO myuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO myuser;

-- Grant privileges on new tables
GRANT ALL PRIVILEGES ON TABLE search_terms TO myuser;
GRANT ALL PRIVILEGES ON TABLE news_articles TO myuser;
GRANT ALL PRIVILEGES ON TABLE entity_mentions TO myuser;
GRANT ALL PRIVILEGES ON TABLE analytics_cache TO myuser;
GRANT ALL PRIVILEGES ON SEQUENCE search_terms_id_seq TO myuser;
GRANT ALL PRIVILEGES ON SEQUENCE news_articles_id_seq TO myuser;
GRANT ALL PRIVILEGES ON SEQUENCE entity_mentions_id_seq TO myuser;
GRANT ALL PRIVILEGES ON SEQUENCE analytics_cache_id_seq TO myuser;
