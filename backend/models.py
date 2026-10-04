from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    user_id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    department = Column(String)
    role = Column(String, default='employee')

class Resource(Base):
    __tablename__ = "resources"
    resource_id = Column(String, primary_key=True)
    resource_name = Column(String, nullable=False)
    owning_department = Column(String)
    sensitivity = Column(String)

class AccessViolation(Base):
    __tablename__ = "access_violations"
    violation_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.user_id"))
    resource_id = Column(String, ForeignKey("resources.resource_id"))
    requester_department = Column(String)
    resource_department = Column(String)
    attempted_at = Column(String)

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    event_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, index=True)
    user_name = Column(String)
    department = Column(String)
    timestamp = Column(String, index=True)
    login_hour = Column(Integer)
    location = Column(String)
    ip_address = Column(String)
    device_id = Column(String)
    download_mb = Column(Float)
    files_accessed = Column(Integer)
    accessed_department = Column(String)
    is_anomaly = Column(Boolean)
    ml_anomaly_score = Column(Float, default=0.0)

class UserBaseline(Base):
    __tablename__ = "user_baselines"
    user_id = Column(String, primary_key=True)
    avg_download_mb = Column(Float)
    std_download_mb = Column(Float)
    usual_login_hour_start = Column(Integer)
    usual_login_hour_end = Column(Integer)
    known_locations = Column(String)
    known_devices = Column(String)
    usual_department = Column(String)
    last_updated = Column(String)
    baseline_window_days = Column(Integer, default=30)
    last_recalculated = Column(String)

class ShiftChangeLog(Base):
    __tablename__ = "shift_change_log"
    log_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String)
    old_hour_start = Column(Integer)
    old_hour_end = Column(Integer)
    new_hour_start = Column(Integer)
    new_hour_end = Column(Integer)
    detected_date = Column(String)
    reason = Column(String)

class TrustedDevice(Base):
    __tablename__ = "trusted_devices"
    device_id = Column(String, primary_key=True)
    user_id = Column(String, primary_key=True)
    device_name = Column(String)
    status = Column(String, default='unrecognized')
    added_by = Column(String)
    added_date = Column(String)
    notes = Column(String)

class EmployeeHRStatus(Base):
    __tablename__ = "employee_hr_status"
    user_id = Column(String, primary_key=True)
    employment_status = Column(String, default='active')
    travel_declared = Column(Boolean, default=False)
    travel_start_date = Column(String)
    travel_end_date = Column(String)
    notice_period_start_date = Column(String)
    last_updated = Column(String)

class RiskEvent(Base):
    __tablename__ = "risk_events"
    risk_event_id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(Integer, ForeignKey("activity_logs.event_id"), index=True)
    user_id = Column(String, index=True)
    risk_score = Column(Integer, index=True)
    reasons = Column(String)
    flagged_at = Column(String)
    reviewed = Column(Boolean, default=False)
    status = Column(String, default='new', index=True)
    assigned_to_analyst = Column(String)
    analyst_notes = Column(String)
    resolved_at = Column(String)

class ServerCommunication(Base):
    __tablename__ = "server_communications"
    comm_id = Column(Integer, primary_key=True, autoincrement=True)
    source_server = Column(String, nullable=False, index=True)
    destination_server = Column(String, nullable=False)
    timestamp = Column(String, nullable=False, index=True)
    data_transferred_mb = Column(Float)
    is_anomaly = Column(Boolean, default=False)

class RegisteredAgent(Base):
    __tablename__ = "registered_agents"
    agent_id = Column(Integer, primary_key=True, autoincrement=True)
    hostname = Column(String, unique=True, nullable=False, index=True)
    ip_address = Column(String)
    assigned_user_id = Column(String)
    first_seen = Column(String)
    last_seen = Column(String)
    status = Column(String, default='offline')
    total_events_sent = Column(Integer, default=0)
