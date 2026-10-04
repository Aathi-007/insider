# Insider UEBA - Commands Cheat Sheet

This file contains all the necessary commands to run, test, and demonstrate the Insider UEBA platform. 

> **Note**: For all Python backend commands, ensure you are in the `backend` folder and your virtual environment is activated.

## 1. Environment Setup (Docker Fix)
If `docker` is not recognized in your terminal, run this in PowerShell to temporarily add it to your path:
```powershell
$env:Path += ";C:\Users\GOKULAKANNAN\AppData\Local\Programs\DockerDesktop\resources\bin"
```

## 2. Start the Database
Starts the PostgreSQL database container in the background.
```powershell
docker compose up -d
```

## 3. Populate Demo Data (Run before a Demo)
Seeds the SQLite database with 90 days of synthetic logs, anomalies, and trains the AI model. **Do this before your presentation!**
```powershell
cd backend
.\venv\Scripts\activate
python seed_full_demo_data.py
```

## 4. Start the Backend API
Runs the FastAPI server which serves data to the dashboard and processes telemetry. (If you stopped it to run the seed script, you will need to run this again!)
```powershell
cd backend
.\venv\Scripts\activate
python main.py
```

## 5. Start the Frontend Dashboard
Runs the React/Vite development server for the web interface.
```powershell
cd frontend
npm run dev
```
*Access the dashboard at: http://localhost:5173*

## 6. Live Simulation Scripts (During the Demo)
Run these in separate, new terminal windows when you want to show real-time data flowing into the dashboard.

**A. Simulate a Device (Agent)**
Simulates a device generating network traffic and sending telemetry logs to the backend.
```powershell
python agent_collector.py
```

**B. Simulate a SOC Analyst**
Simulates an automated analyst script querying the API for open alerts.
```powershell
cd backend
python simulate_analyst.py
```
