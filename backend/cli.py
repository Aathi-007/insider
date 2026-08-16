import os
import json
import time
from pathlib import Path
from datetime import datetime, timedelta

import typer
import requests
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.live import Live

app = typer.Typer(help="UEBA CLI Interface")
console = Console()

API_URL = os.environ.get("UEBA_API_URL", "http://localhost:8000")
API_KEY = os.environ.get("UEBA_API_KEY", "dev-local-key")
SESSION_FILE = Path.home() / ".ueba_cli_session.json"

def get_session():
    if SESSION_FILE.exists():
        try:
            with open(SESSION_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return None

def get_headers():
    headers = {"X-API-Key": API_KEY}
    session = get_session()
    if session and "access_token" in session:
        headers["Authorization"] = f"Bearer {session['access_token']}"
    return headers

@app.command()
def login():
    """Login to the UEBA system and save the session."""
    username = typer.prompt("Username")
    password = typer.prompt("Password", hide_input=True)
    
    url = f"{API_URL}/login"
    try:
        response = requests.post(url, json={"username": username, "password": password}, headers={"X-API-Key": API_KEY})
        if response.status_code == 200:
            data = response.json()
            session = {
                "username": username,
                "access_token": data.get("access_token")
            }
            with open(SESSION_FILE, "w") as f:
                json.dump(session, f)
            console.print("[green]Login successful! Session saved.[/green]")
        else:
            console.print(f"[red]Login failed: {response.text}[/red]")
    except Exception as e:
        console.print(f"[red]Error connecting to server: {e}[/red]")

def build_alerts_table(alerts):
    table = Table(title="UEBA Alerts")
    table.add_column("Risk Score", justify="right")
    table.add_column("User ID")
    table.add_column("Flagged At")
    table.add_column("Reasons")
    
    for alert in alerts:
        score = alert.get("risk_score", 0)
        color = "red" if score >= 70 else "yellow" if score >= 40 else "green"
        score_text = f"[{color}]{score}[/{color}]"
        
        user_id = alert.get("user_id", "")
        flagged_at = alert.get("flagged_at", "")
        reasons = ", ".join(alert.get("reasons", []))
        
        table.add_row(score_text, user_id, flagged_at, reasons)
        
    return table

@app.command()
def alerts():
    """Fetch and display current alerts."""
    url = f"{API_URL}/alerts"
    try:
        response = requests.get(url, headers=get_headers())
        if response.status_code == 200:
            data = response.json()
            alerts_list = data.get("alerts", [])
            table = build_alerts_table(alerts_list)
            console.print(table)
        else:
            console.print(f"[red]Failed to fetch alerts: {response.text}[/red]")
    except Exception as e:
        console.print(f"[red]Error connecting to server: {e}[/red]")

@app.command()
def user(user_id: str):
    """Fetch and display details for a specific user."""
    url = f"{API_URL}/user/{user_id}"
    try:
        response = requests.get(url, headers=get_headers())
        if response.status_code == 200:
            data = response.json()
            baseline = data.get("baseline", {})
            activity = data.get("activity_history", [])[:5]  # show recent 5
            
            baseline_text = "\n".join([f"[bold]{k}:[/bold] {v}" for k, v in baseline.items()])
            console.print(Panel(baseline_text, title=f"Baseline: {user_id}", border_style="blue"))
            
            if activity:
                act_table = Table(title=f"Recent Activity (Last 5)")
                act_table.add_column("Timestamp")
                act_table.add_column("Action")
                act_table.add_column("Dept")
                act_table.add_column("IP")
                for act in activity:
                    act_table.add_row(
                        str(act.get("timestamp", "")),
                        f"{act.get('files_accessed', 0)} files, {act.get('download_mb', 0)}MB",
                        str(act.get("accessed_department", "")),
                        str(act.get("ip_address", ""))
                    )
                console.print(act_table)
            else:
                console.print("[yellow]No recent activity found.[/yellow]")
        else:
            console.print(f"[red]Failed to fetch user data: {response.text}[/red]")
    except Exception as e:
        console.print(f"[red]Error connecting to server: {e}[/red]")

@app.command()
def watch():
    """Poll for new alerts every 5 seconds and display anomalies one by one."""
    url = f"{API_URL}/alerts"
    seen_alerts = set()
    first_run = True
    
    console.print("[bold cyan]Connected to UEBA Engine. Listening for real-time anomalies...[/bold cyan]")
    
    try:
        while True:
            response = requests.get(url, headers=get_headers())
            if response.status_code == 200:
                data = response.json()
                alerts_list = data.get("alerts", [])
                
                # Sort oldest to newest
                alerts_list.sort(key=lambda x: x.get("flagged_at", ""))
                
                new_alerts = []
                for alert in alerts_list:
                    # Unique ID for the alert
                    alert_id = f"{alert.get('user_id')}_{alert.get('flagged_at')}"
                    if alert_id not in seen_alerts:
                        seen_alerts.add(alert_id)
                        new_alerts.append(alert)
                
                if first_run:
                    first_run = False
                    if new_alerts:
                        console.print(f"[dim]Initialized with {len(new_alerts)} historical alerts. Watching for new anomalies...[/dim]")
                else:
                    for alert in new_alerts:
                        # Print each new anomaly in its own box
                        table = Table(title="🚨 NEW ANOMALY DETECTED 🚨", title_style="bold red", show_header=True, header_style="bold magenta")
                        table.add_column("Risk Score", justify="right")
                        table.add_column("User ID")
                        table.add_column("Flagged At")
                        table.add_column("Reasons")
                        
                        score = alert.get("risk_score", 0)
                        color = "red" if score >= 70 else "yellow" if score >= 40 else "green"
                        score_text = f"[{color}]{score}[/{color}]"
                        
                        user_id = alert.get("user_id", "")
                        flagged_at = alert.get("flagged_at", "")
                        reasons = ", ".join(alert.get("reasons", []))
                        
                        table.add_row(score_text, user_id, flagged_at, reasons)
                        console.print(table)
            else:
                console.print(f"[red]Failed to fetch alerts: {response.text}[/red]")
                
            time.sleep(5)
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped watching.[/yellow]")

@app.command()
def heatmap():
    """Display a 30-day user risk heatmap."""
    url = f"{API_URL}/analytics/daily-risk"
    try:
        response = requests.get(url, headers=get_headers())
        if response.status_code == 200:
            data = response.json()
            
            # Find the date range (last 30 days ending today)
            today = datetime.now().date()
            dates = [(today - timedelta(days=i)).isoformat() for i in range(29, -1, -1)]
            
            # Group data by user
            users = {}
            for row in data:
                uid = row.get("user_id")
                uname = row.get("user_name", uid)
                date_str = row.get("date")
                score = row.get("avg_score", 0)
                
                if uid not in users:
                    users[uid] = {"name": uname, "scores": {}}
                users[uid]["scores"][date_str] = score
                
            table = Table(title="30-Day Risk Heatmap", show_header=True, header_style="bold magenta")
            table.add_column("User", width=20)
            
            # Add columns for each day (e.g. just day of month to save space)
            for d in dates:
                day_str = d[-2:]  # just the DD part
                table.add_column(day_str, justify="center")
                
            for uid, udata in users.items():
                row_items = [f"{udata['name']} ({uid})"]
                for d in dates:
                    score = udata["scores"].get(d)
                    if score is None:
                        # No data
                        row_items.append(Text("■", style="grey50"))
                    else:
                        if score >= 70:
                            color = "red"
                        elif score >= 40:
                            color = "yellow"
                        else:
                            color = "green"
                        row_items.append(Text("■", style=color))
                table.add_row(*row_items)
                
            console.print(table)
        else:
            console.print(f"[red]Failed to fetch heatmap data: {response.text}[/red]")
    except Exception as e:
        console.print(f"[red]Error connecting to server: {e}[/red]")

if __name__ == "__main__":
    app()
