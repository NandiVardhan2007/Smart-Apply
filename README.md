# Smart Apply

Smart Apply is an AI-powered job application assistant designed to streamline the process of applying to jobs. It provides tools for tailoring resumes, checking ATS compatibility, conducting voice AI mock interviews, and getting project recommendations.

## Features

- **Resume Tailoring**: Automatically modify your resume to fit specific job descriptions using AI.
- **ATS Checker**: Evaluate how well your resume matches a job description and get actionable feedback.
- **Live Voice Interview Studio**: Participate in real-time voice-based mock interviews with an AI interviewer featuring Judge0 sandboxed code execution, facial vision HUD telemetry, and performance reports.
- **Project Recommender**: Get recommendations for projects to build based on your skills and target roles.
- **AI Chatbot**: Ask questions and get career advice from a built-in AI assistant.

## Documentation

For a comprehensive guide covering **Architecture**, **System Design**, **Data Models**, **Target Audience**, **Estimated Userbase**, and **Future Scope**, please see [DOCUMENTATION.md](file:///d:/SMARTAPPLY/DOCUMENTATION.md).

## Tech Stack

### Frontend
- **Framework**: React with TypeScript, built using Vite.
- **Styling**: Modern dark glassmorphism styling with Vanilla CSS tokens.
- **Communication**: REST APIs and WebSockets.

### Backend
- **Framework**: FastAPI (Python).
- **Database**: MongoDB with Beanie ODM.
- **AI & Voice Integration**: NVIDIA NIM (Llama 3.1) for LLMs, Web Speech API for voice interactions.
- **Code Execution Sandbox**: Judge0 CE API.
- **Storage**: Cloudflare R2 for handling uploads.

## Project Structure

- `frontend/`: Contains the React/Vite application.
- `backend/`: Contains the FastAPI server, database models, and AI services.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- MongoDB running locally or a MongoDB Atlas URI

### Backend Setup

1. Navigate to the backend directory:
   ```bash
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

## License

This project is licensed under the MIT License.
