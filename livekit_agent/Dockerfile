# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download the Piper TTS ONNX models during the build phase
# This prevents downloading them every time the container starts
RUN python -c "\
from huggingface_hub import hf_hub_download; \
hf_hub_download(repo_id='navgurukul-ai-labs/text-to-speech-en-IN-piper', filename='en_IN-dataset=spicor-english-base=ljspeech-epochs=1089.onnx', local_dir='/app'); \
hf_hub_download(repo_id='navgurukul-ai-labs/text-to-speech-en-IN-piper', filename='en_IN-dataset=spicor-english-base=ljspeech-epochs=1089.onnx.json', local_dir='/app')\
"

# Copy the rest of the application
COPY . /app/

# Run the agent in production mode
CMD ["python", "agent.py", "start"]
