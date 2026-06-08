# Admin Dashboard (React + Vite + Tailwind) + FastAPI

Scaffold project: frontend React (Vite + Tailwind) and backend FastAPI with JWT authentication (mock data).

Run frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Run backend
```bash
cd backend
python -m venv .venv
# On PowerShell
. .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Login (mock user): POST `http://localhost:8000/auth/login` with JSON `{ "username": "admin", "password": "password" }` to receive JWT.

The backend is currently mocked for orders and auth. Set `backend/.env` with `SECRET_KEY` and `MONGODB_URI` later when switching to MongoDB Atlas.
