#!/bin/bash

# Script to pull Ollama model on first run
# Run this after docker-compose up

echo "🔄 Pulling Llama 3.1 8B model for RAG..."

# Wait for Ollama service to be ready
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
  echo "Waiting for Ollama service..."
  sleep 5
done

echo "✅ Ollama service is ready"

# Pull the model
docker exec civix-ollama ollama pull llama3.1:8b

echo "✅ Model pulled successfully!"
echo ""
echo "You can now use the RAG bot endpoints."