# Smart Apply

Smart Apply is an AI-powered job application assistant designed to streamline the process of applying to jobs. It provides tools for tailoring resumes, checking ATS compatibility, conducting mock live interviews, and getting project recommendations.

## Features

- **Resume Tailoring**: Automatically modify your resume to fit specific job descriptions using AI.
- **ATS Checker**: Evaluate how well your resume matches a job description and get actionable feedback.
- **Live Interview Practice**: Participate in voice-based mock interviews with an AI interviewer powered by LiveKit and local LLMs/TTS.
- **Project Recommender**: Get recommendations for projects to build based on your skills and target roles.
- **AI Chatbot**: Ask questions and get career advice from a built-in AI assistant.

## Tech Stack

### Frontend
- **Framework**: React with TypeScript, built using Vite.
- **Styling**: Tailwind CSS (assumed based on standard modern React setups).
- **Communication**: REST APIs and WebSockets.

### Backend
- **Framework**: FastAPI (Python).
- **Database**: MongoDB with Beanie ODM.
- **AI & Voice Integration**: LiveKit for WebRTC, NVIDIA NIM (Llama 3.1) for LLM, Groq (Whisper) for STT, and Piper for TTS.
- **Storage**: Cloudflare R2 for handling uploads.

## Project Structure

- `frontend/`: Contains the React/Vite application.
- `backend/`: Contains the FastAPI server, background workers for AI interviews, and database models.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- MongoDB running locally or a MongoDB Atlas URI

### Backend Setup

1. Navigate to the backend directory:
   ``bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   Copy `.env.example` to `.env` and fill in your API keys and configuration details.
5. Run the backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
6. Run the LiveKit Interview Worker (if using live interviews):
   ```bash
   python agents/interview_worker.py start
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open the app in your browser at `http://localhost:5173`.

## Environment Variables

Ensure you have your `.env` file correctly configured in the `backend/` directory. API keys for NVIDIA, Groq, LiveKit, and MongoDB are required for full functionality.

## License

This project is licensed under the MIT License.
