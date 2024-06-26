-- Create user if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'myuser') THEN
        CREATE USER myuser WITH PASSWORD 'mypassword';
        ALTER USER myuser WITH SUPERUSER;
    END IF;
END $$;

-- Check if the database exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_database WHERE datname = 'mydatabase') THEN
        CREATE DATABASE mydatabase;
        GRANT ALL PRIVILEGES ON DATABASE mydatabase TO myuser;
    END IF;
END $$;

-- Connect to the database and create tables
\c mydatabase;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
