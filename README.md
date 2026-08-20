# Insider - User & Entity Behavior Analytics (UEBA)

**Insider** is an advanced User and Entity Behavior Analytics (UEBA) platform designed to detect insider threats, compromised accounts, and anomalous activities within an organization. By leveraging Machine Learning (Isolation Forest) and rule-based risk scoring, Insider continuously monitors user activities, network traffic, and device logs to identify deviations from normal behavioral baselines.

---

## 🌟 Key Features

*   **AI-Powered Anomaly Detection**: Utilizes Scikit-Learn's Isolation Forest model to detect unusual patterns in user behavior (e.g., abnormal login hours, excessive downloads, unusual locations).
*   **Dynamic Risk Scoring**: Combines ML predictions with rule-based heuristics to assign a dynamic risk score to users and devices.
*   **Real-time Monitoring & Dashboard**: A comprehensive SOC (Security Operations Center) dashboard built with React and Recharts to visualize threat intelligence, API traffic, and risk trends.
*   **Role-Based Access Control**: Different views and capabilities for Administrators (Full Console & Device Management) and SOC Analysts (Alerts & Investigations).
*   **Simulation Engine**: Includes built-in scripts to simulate real-time normal and malicious traffic for demonstration and testing purposes.

## 🛠️ Technology Stack

*   **Backend**: Python, FastAPI, Pandas, Scikit-Learn, SQLite, Uvicorn
*   **Frontend**: React 19, Vite, Framer Motion (Animations), Recharts (Data Visualization), Lucide React (Icons)

---

## 🚀 Getting Started

### Prerequisites
* Python 3.9+
* Node.js 18+

### 1. Backend Setup (FastAPI)

Navigate to the backend directory, set up a virtual environment, and install dependencies:

```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
# source venv/bin/activate

pip install -r requirements.txt
```

Run the backend application:
```bash
python main.py
# Or using uvicorn directly: uvicorn main:app --reload
```

### 2. Frontend Setup (React/Vite)

Navigate to the frontend directory, install dependencies, and start the development server:

```bash
cd frontend
npm install
npm run dev
```

---

## 🔐 Demo Credentials for Judges

To log in to the dashboard, you can use one of the following pre-seeded demo accounts:

**Administrator Access (Full Console & Devices)**
*   **Username**: `admin`
*   **Password**: `admin123`

**SOC Analyst Access (Alerts & Investigations)**
*   **Username**: `analyst`
*   **Password**: `analyst123`
