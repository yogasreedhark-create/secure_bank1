
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Employee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    emp_id = db.Column(db.String(20), unique=True, nullable=False)
    firstname = db.Column(db.String(50), nullable=False)
    lastname = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    balance = db.Column(db.Float, default=1000)
    kyc_status = db.Column(db.String(20), default="Not Submitted")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    emp_id = db.Column(db.String(20), db.ForeignKey('employee.emp_id'))
    type = db.Column(db.String(50))
    amount = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    emp_id = db.Column(db.String(20), db.ForeignKey('employee.emp_id'))
    ssn = db.Column(db.String(20))
    name = db.Column(db.String(100))
    acc = db.Column(db.String(20))
    acc_type = db.Column(db.String(20))
    balance = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
