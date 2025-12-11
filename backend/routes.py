
from flask import Blueprint, request, jsonify
from models import db, Employee, Transaction, Customer
from werkzeug.security import generate_password_hash, check_password_hash
import random

api = Blueprint('api', __name__)

# Helper to generate emp_id
def generate_emp_id():
    return "EMP" + str(random.randint(100000,999999))

# ------------------ Registration ------------------
@api.route("/register", methods=["POST"])
def register():
    data = request.json
    emp_id = generate_emp_id()
    firstname = data.get("firstname")
    lastname = data.get("lastname")
    email = data.get("email")
    password = data.get("password")

    if Employee.query.filter_by(email=email).first():
        return jsonify({"error":"Email already registered"}), 400

    emp = Employee(
        emp_id=emp_id,
        firstname=firstname,
        lastname=lastname,
        email=email,
        password=generate_password_hash(password)
    )
    db.session.add(emp)
    db.session.commit()
    return jsonify({"message":"Registration successful","emp_id":emp_id})

# ------------------ Login ------------------
@api.route("/login", methods=["POST"])
def login():
    data = request.json
    emp_id = data.get("emp_id")
    password = data.get("password")
    emp = Employee.query.filter_by(emp_id=emp_id).first()
    if not emp or not check_password_hash(emp.password, password):
        return jsonify({"error":"Invalid credentials"}), 401
    return jsonify({"message":"Login successful","emp_id":emp.emp_id})

# ------------------ Deposit ------------------
@api.route("/deposit", methods=["POST"])
def deposit():
    data = request.json
    emp_id = data.get("emp_id")
    amount = float(data.get("amount",0))
    emp = Employee.query.filter_by(emp_id=emp_id).first()
    if not emp:
        return jsonify({"error":"Employee not found"}), 404
    emp.balance += amount
    txn = Transaction(emp_id=emp_id, type="Deposit", amount=amount)
    db.session.add(txn)
    db.session.commit()
    return jsonify({"message":"Deposit successful", "balance":emp.balance})

# ------------------ Withdraw ------------------
@api.route("/withdraw", methods=["POST"])
def withdraw():
    data = request.json
    emp_id = data.get("emp_id")
    amount = float(data.get("amount",0))
    emp = Employee.query.filter_by(emp_id=emp_id).first()
    if not emp or emp.balance < amount:
        return jsonify({"error":"Insufficient balance"}), 400
    emp.balance -= amount
    txn = Transaction(emp_id=emp_id, type="Withdraw", amount=amount)
    db.session.add(txn)
    db.session.commit()
    return jsonify({"message":"Withdraw successful", "balance":emp.balance})

# ------------------ Transfer ------------------
@api.route("/transfer", methods=["POST"])
def transfer():
    data = request.json
    sender_id = data.get("sender_id")
    receiver_id = data.get("receiver_id")
    amount = float(data.get("amount",0))

    sender = Employee.query.filter_by(emp_id=sender_id).first()
    receiver = Employee.query.filter_by(emp_id=receiver_id).first()

    if not sender or sender.balance < amount:
        return jsonify({"error":"Insufficient balance"}), 400
    if not receiver:
        receiver = Employee(emp_id=receiver_id, firstname="Temp", lastname="User", email=f"{receiver_id}@bank.com", password=generate_password_hash("temp"), balance=0)
        db.session.add(receiver)

    sender.balance -= amount
    receiver.balance += amount

    db.session.add(Transaction(emp_id=sender_id, type=f"Transfer to {receiver_id}", amount=amount))
    db.session.add(Transaction(emp_id=receiver_id, type=f"Received from {sender_id}", amount=amount))
    db.session.commit()

    return jsonify({"message":"Transfer successful", "sender_balance":sender.balance, "receiver_balance":receiver.balance})
