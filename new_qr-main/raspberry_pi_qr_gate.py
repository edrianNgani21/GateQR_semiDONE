#!/usr/bin/env python3
"""
Raspberry Pi QR Code Scanner with Automatic Gate Control
Automatically opens gate barrier for 10 seconds after valid QR scan
"""

import cv2
import numpy as np
import requests
import time
import RPi.GPIO as GPIO
from pyzbar.pyzbar import decode
import threading
import json

# Configuration
API_BASE_URL = "http://192.168.100.77:5173/api"  # Your computer's IP
GATE_API_KEY = "df8ccf8d904f93591a8cb1dfe0211f653fbf785e7b87687e77deb41d907c6fef"  # Match your .env
SERVO_PIN = 18  # GPIO pin for entrance motor (Motor 1)
SERVO_PIN_2 = 19  # GPIO pin for exit motor (Motor 2)
GATE_OPEN_TIME = 10  # seconds to keep entrance gate open
EXIT_GATE_OPEN_TIME = 15  # seconds to keep exit gate open

# GPIO Setup
GPIO.setmode(GPIO.BCM)
GPIO.setup(SERVO_PIN, GPIO.OUT)
GPIO.setup(SERVO_PIN_2, GPIO.OUT)
servo = GPIO.PWM(SERVO_PIN, 50)  # 50Hz frequency for entrance motor
servo.start(0)
servo2 = GPIO.PWM(SERVO_PIN_2, 50)  # 50Hz frequency for exit motor
servo2.start(0)

# Gate control functions
def open_gate():
    """Open the gate barrier (servo motor)"""
    print("🚀 Opening gate...")
    # Adjust these values based on your servo
    servo.ChangeDutyCycle(7.5)  # 90 degrees (open position)
    time.sleep(1)
    servo.ChangeDutyCycle(0)  # Stop sending signals

def close_gate():
    """Close the gate barrier (servo motor)"""
    print("🔒 Closing gate...")
    # Adjust these values based on your servo
    servo.ChangeDutyCycle(2.5)  # 0 degrees (closed position)
    time.sleep(1)
    servo.ChangeDutyCycle(0)  # Stop sending signals

def gate_control_timer():
    """Timer to automatically close gate after GATE_OPEN_TIME seconds"""
    time.sleep(GATE_OPEN_TIME)
    close_gate()

def open_gate_with_timer():
    """Open gate and start timer to auto-close"""
    open_gate()
    # Start timer in separate thread so it doesn't block QR scanning
    timer_thread = threading.Thread(target=gate_control_timer)
    timer_thread.daemon = True
    timer_thread.start()

# Exit gate (Motor 2) control functions
def open_exit_gate():
    """Open the exit gate barrier (servo motor 2)"""
    print("🚀 Opening exit gate...")
    # Adjust these values based on your servo
    servo2.ChangeDutyCycle(7.5)  # 90 degrees (open position)
    time.sleep(1)
    servo2.ChangeDutyCycle(0)  # Stop sending signals

def close_exit_gate():
    """Close the exit gate barrier (servo motor 2)"""
    print("🔒 Closing exit gate...")
    # Adjust these values based on your servo
    servo2.ChangeDutyCycle(2.5)  # 0 degrees (closed position)
    time.sleep(1)
    servo2.ChangeDutyCycle(0)  # Stop sending signals

# Exit gate timer management
exit_gate_open_time = 0
exit_gate_timer_active = False
exit_gate_lock = threading.Lock()

def exit_gate_timer():
    """Timer to automatically close exit gate after EXIT_GATE_OPEN_TIME seconds"""
    global exit_gate_open_time, exit_gate_timer_active

    while True:
        time.sleep(1)
        with exit_gate_lock:
            if exit_gate_timer_active:
                elapsed = time.time() - exit_gate_open_time
                if elapsed >= EXIT_GATE_OPEN_TIME:
                    close_exit_gate()
                    exit_gate_timer_active = False
                    print("⏰ Exit gate timer expired - gate closed")

def open_exit_gate_with_refresh():
    """Open exit gate and refresh timer (called when QR code is scanned)"""
    global exit_gate_open_time, exit_gate_timer_active

    with exit_gate_lock:
        # If gate is not open, open it
        if not exit_gate_timer_active:
            open_exit_gate()
            exit_gate_timer_active = True
            print("⏰ Exit gate opened - starting 15 second timer")

        # Refresh the timer regardless of whether gate was already open
        exit_gate_open_time = time.time()
        print(f"⏰ Exit gate timer refreshed to 15 seconds")

# API Functions
def lookup_qr_code(qr_data):
    """Lookup QR code in the system"""
    try:
        headers = {
            "X-Gate-Key": GATE_API_KEY,
            "Content-Type": "application/json"
        }
        # Use GET with QR parameter as per the server implementation
        response = requests.get(
            f"{API_BASE_URL}/gate/lookup",
            params={"qr": qr_data},
            headers=headers,
            timeout=5
        )
        return response.json()
    except requests.RequestException as e:
        print(f"❌ API Error: {e}")
        return {"error": "Connection failed"}

def record_entry(registration_id, logged_status=None, reason=None):
    """Record vehicle entry in the system"""
    try:
        headers = {
            "X-Gate-Key": GATE_API_KEY,
            "Content-Type": "application/json"
        }
        response = requests.post(
            f"{API_BASE_URL}/gate/entry",
            json={
                "registration_id": registration_id,
                "logged_status": logged_status,
                "reason": reason
            },
            headers=headers,
            timeout=5
        )
        return response.json()
    except requests.RequestException as e:
        print(f"❌ Entry recording error: {e}")
        return {"error": "Connection failed"}

def record_exit(registration_id, logged_status=None, reason=None):
    """Record vehicle exit in the system"""
    try:
        headers = {
            "X-Gate-Key": GATE_API_KEY,
            "Content-Type": "application/json"
        }
        response = requests.post(
            f"{API_BASE_URL}/gate/exit",
            json={
                "registration_id": registration_id,
                "logged_status": logged_status,
                "reason": reason
            },
            headers=headers,
            timeout=5
        )
        return response.json()
    except requests.RequestException as e:
        print(f"❌ Exit recording error: {e}")
        return {"error": "Connection failed"}

# Manual Entry Functions for Guests
def manual_visitor_entry(name, plate, id_number, purpose):
    """Record manual guest entry and open entrance gate"""
    try:
        headers = {
            "X-Gate-Key": GATE_API_KEY,
            "Content-Type": "application/json"
        }
        response = requests.post(
            f"{API_BASE_URL}/gate/manual",
            json={
                "type": "in",
                "name": name,
                "mobile": None,  # Mobile is optional now
                "make_model": "Visitor/Concessionaire",
                "plate": plate,
                "id_number": id_number,
                "purpose": purpose
            },
            headers=headers,
            timeout=5
        )
        result = response.json()

        if result.get("success"):
            print(f"✅ Visitor entry recorded: {name} - {plate}")
            print(f"🎫 Ticket Number: {result.get('ticket_no')}")
            open_gate_with_timer()  # Open Motor 1 (entrance gate)
            return True
        else:
            print(f"❌ Failed to record visitor entry: {result.get('error')}")
            return False
    except requests.RequestException as e:
        print(f"❌ Manual entry error: {e}")
        return False

def lookup_visitor_by_plate(plate=None, name=None):
    """Lookup guest by plate number or name"""
    try:
        headers = {
            "X-Gate-Key": GATE_API_KEY,
            "Content-Type": "application/json"
        }
        params = {}
        if plate:
            params["plate"] = plate
        if name:
            params["name"] = name
        response = requests.get(
            f"{API_BASE_URL}/gate/lookup-plate",
            params=params,
            headers=headers,
            timeout=5
        )
        return response.json()
    except requests.RequestException as e:
        print(f"❌ Guest lookup error: {e}")
        return {"error": "Connection failed"}

def manual_visitor_exit(search_term):
    """Record manual guest exit and open exit gate by plate or name"""
    try:
        # First try to lookup as plate number
        lookup_result = lookup_visitor_by_plate(plate=search_term)

        # If plate lookup fails, try as name
        if not lookup_result.get("found"):
            lookup_result = lookup_visitor_by_plate(name=search_term)

        if not lookup_result.get("found"):
            print(f"❌ No active guest found with: {search_term}")
            return False

        visitor = lookup_result.get("visitor")
        print(f"\n👤 Guest Found:")
        print(f"   Name: {visitor.get('name')}")
        print(f"   Plate: {visitor.get('plate')}")
        print(f"   Entry Time: {visitor.get('in_time')}")
        print(f"   Ticket: {visitor.get('ticket_no')}")

        # Record exit
        headers = {
            "X-Gate-Key": GATE_API_KEY,
            "Content-Type": "application/json"
        }
        response = requests.post(
            f"{API_BASE_URL}/gate/manual",
            json={
                "type": "out",
                "ticket_no": visitor.get('ticket_no')
            },
            headers=headers,
            timeout=5
        )
        result = response.json()

        if result.get("success"):
            print(f"✅ Guest exit recorded: {visitor.get('name')} - {visitor.get('plate')}")
            open_exit_gate_with_refresh()  # Open Motor 2 (exit gate)
            return True
        else:
            print(f"❌ Failed to record guest exit: {result.get('error')}")
            return False
    except requests.RequestException as e:
        print(f"❌ Manual exit error: {e}")
        return False

# Manual Entry Interface
def manual_entry_menu():
    """Simple text-based menu for manual visitor entry/exit"""
    while True:
        print("\n" + "="*50)
        print("🚗 MANUAL ENTRY MENU")
        print("="*50)
        print("1. Guest Entry (Motor 1) - Name, Plate, ID#, Purpose")
        print("2. Guest Exit (Motor 2) - Search by Plate or Name")
        print("3. Return to QR Scanning")
        print("="*50)

        choice = input("Select option (1-3): ").strip()

        if choice == '1':
            print("\n📝 Visitor Entry Form")
            name = input("Name: ").strip()
            plate = input("Plate Number: ").strip()
            id_number = input("ID Number (Driver's License): ").strip()
            purpose = input("Purpose (Reason): ").strip()

            if name and plate and id_number and purpose:
                if manual_visitor_entry(name, plate, id_number, purpose):
                    print("✅ Entry successful! Gate opening...")
                    time.sleep(2)
                else:
                    print("❌ Entry failed. Please try again.")
            else:
                print("❌ All fields are required!")

        elif choice == '2':
            print("\n📝 Visitor Exit Form")
            search_term = input("Search by Plate Number or Name: ").strip()

            if search_term:
                confirm = input("Open exit gate? (y/n): ").strip().lower()
                if confirm == 'y':
                    if manual_visitor_exit(search_term):
                        print("✅ Exit successful! Gate opening...")
                        time.sleep(2)
                    else:
                        print("❌ Exit failed. Please try again.")
                else:
                    print("❌ Exit cancelled.")
            else:
                print("❌ Search term is required!")

        elif choice == '3':
            print("🔄 Returning to QR scanning...")
            break

        else:
            print("❌ Invalid option. Please select 1-3.")

# Display Functions
def display_vehicle_info(data):
    """Display vehicle information on screen"""
    if "error" in data:
        print(f"❌ {data['error']}")
        return False

    # Handle both old and new API response formats
    if "registered" in data:
        if not data.get("registered"):
            print("❌ Vehicle not registered in system")
            return False
        registration_data = data.get('registration', {})
        logged_status = data.get('logged_status', 'Unknown')
    else:
        registration_data = data
        logged_status = data.get('logged_status', 'Unknown')

    print("\n" + "="*50)
    print("🚗 VEHICLE INFORMATION")
    print("="*50)
    print(f"Name: {registration_data.get('first_name', '')} {registration_data.get('last_name', '')}")
    # Get vehicle info from vehicle_information relation if available
    vehicle_info = registration_data.get('vehicle_information', {})
    if vehicle_info and isinstance(vehicle_info, dict):
        print(f"Plate: {vehicle_info.get('plate_number', 'N/A')}")
        print(f"Make: {vehicle_info.get('brand', 'N/A')}")
        print(f"Type: {vehicle_info.get('type', 'N/A')}")
        print(f"Color: {vehicle_info.get('color', 'N/A')}")
    else:
        print(f"Plate: N/A")
        print(f"Make: N/A")
        print(f"Type: N/A")
        print(f"Color: N/A")
    print(f"Role: {registration_data.get('role', '')}")
    print(f"Status: {registration_data.get('status', '')}")
    print(f"Campus: {registration_data.get('campus', '')}")
    print(f"Current Location: {logged_status}")
    print("="*50)
    return True

# QR Scanning
def scan_qr_codes():
    """Main QR scanning loop"""
    print("🎥 Starting QR scanner...")
    print("Press 'm' for manual entry, 'q' to quit")

    # Start exit gate timer thread
    exit_timer_thread = threading.Thread(target=exit_gate_timer, daemon=True)
    exit_timer_thread.start()

    cap = cv2.VideoCapture(0)  # Use default camera
    last_qr_scan = 0
    qr_cooldown = 3  # seconds between scans to prevent duplicates

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("❌ Failed to capture frame")
                break

            # Decode QR codes
            decoded_objects = decode(frame)

            for obj in decoded_objects:
                qr_data = obj.data.decode('utf-8')
                current_time = time.time()

                # Check cooldown to prevent duplicate scans
                if current_time - last_qr_scan > qr_cooldown:
                    print(f"\n📱 QR Code detected: {qr_data}")
                    last_qr_scan = current_time

                    # Lookup QR code in system
                    result = lookup_qr_code(qr_data)

                    if display_vehicle_info(result):
                        # Handle both old and new API response formats
                        if "registered" in result:
                            registration_data = result.get('registration', {})
                            vehicle_id = registration_data.get('registration_id')  # Use registration_id from database
                            status = registration_data.get('status')
                            logged_status = result.get('logged_status', 'Outside')  # Get from top-level response
                        else:
                            vehicle_id = result.get('registration_id')  # Use registration_id from database
                            status = result.get('status')
                            logged_status = result.get('logged_status', 'Outside')  # Get from top-level response

                        # Valid QR code - determine which gate to use based on current status
                        if status in ['distributed', 'dept_val', 'osa_val', 'completed']:
                            # Check if vehicle is currently inside (logged_status == 'Inside')
                            if logged_status == 'Inside':
                                print("✅ Vehicle exiting - Opening exit gate automatically")
                                open_exit_gate_with_refresh()
                                # Record exit
                                record_exit(vehicle_id, status, None)
                            else:
                                print("✅ Vehicle entering - Opening entrance gate automatically")
                                open_gate_with_timer()
                                # Record entry
                                record_entry(vehicle_id, status, None)
                        else:
                            print(f"⚠️ Vehicle status: {status} - Gate not opened")
                            record_entry(vehicle_id, status, f"Status: {status}")
                    else:
                        print("❌ Invalid QR code")

                # Draw rectangle around QR code
                points = obj.polygon
                if len(points) > 4:
                    hull = cv2.convexHull(np.array([point for point in points], dtype=np.int32))
                    cv2.polylines(frame, [hull], True, (0, 255, 0), 2)

            # Display countdown if entrance gate is open
            if time.time() - last_qr_scan < GATE_OPEN_TIME and last_qr_scan > 0:
                remaining_time = int(GATE_OPEN_TIME - (time.time() - last_qr_scan))
                cv2.putText(frame, f"Entrance Gate Open: {remaining_time}s", (10, 30),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

            # Display countdown if exit gate is open
            with exit_gate_lock:
                if exit_gate_timer_active:
                    remaining_time = int(EXIT_GATE_OPEN_TIME - (time.time() - exit_gate_open_time))
                    cv2.putText(frame, f"Exit Gate Open: {remaining_time}s", (10, 60),
                               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

            cv2.imshow('QR Scanner', frame)

            # Exit on 'q' key, manual entry on 'm' key
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('m'):
                cv2.destroyAllWindows()
                manual_entry_menu()
                # Restart camera after manual entry
                cap = cv2.VideoCapture(0)

    finally:
        cap.release()
        cv2.destroyAllWindows()
        servo.stop()
        servo2.stop()
        GPIO.cleanup()
        print("👋 Scanner stopped")

if __name__ == "__main__":
    try:
        scan_qr_codes()
    except KeyboardInterrupt:
        print("\n👋 Interrupted by user")
        servo.stop()
        servo2.stop()
        GPIO.cleanup()