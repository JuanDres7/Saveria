-- Se ejecuta una sola vez, al crear el volumen de Postgres.
-- La base `saveria` ya la crea la imagen (POSTGRES_DB).
CREATE DATABASE saveria_test;

\connect saveria
CREATE EXTENSION IF NOT EXISTS vector;

\connect saveria_test
CREATE EXTENSION IF NOT EXISTS vector;
