import os
import warnings

os.environ["OPENCV_LOG_LEVEL"] = "FATAL"
os.environ["QT_LOGGING_RULES"] = "*.debug=false;qt.qpa.*=false"
warnings.filterwarnings("ignore", module="gpiozero")

import cv2
import time
import base64
import threading
import numpy as np
from gpiozero import AngularServo, Device
from collections import deque
import re
from supabase import create_client, Client
from datetime import datetime

# ==============================================================================
# CONFIGURATION
# ==============================================================================
import os

def load_env():
    env_dict = {}
    try:
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        with open(env_path) as f:
            for line in f:
                if line.strip() and not line.startswith("#"):
                    key, val = line.strip().split("=", 1)
                    env_dict[key.strip()] = val.strip().strip("'\"")
    except FileNotFoundError:
        print("Warning: .env file not found. Using default configs.")
    return env_dict

print("DEBUG: Startup - Loading environment variables...")
env_vars = load_env()
SUPABASE_URL = env_vars.get("SUPABASE_URL", "https://nrrbkvtwnoqshtzliijq.supabase.co")
SUPABASE_KEY = env_vars.get("SUPABASE_SERVICE_ROLE_KEY", env_vars.get("PRIVATE_SUPABASE_SERVICE_ROLE_KEY", ""))
GATE_API_KEY = env_vars.get("PRIVATE_GATE_API_KEY", "replace-with-a-secure-random-gate-key")
CAMERA_ZOOM = 2.0  # Adjust this to change digital zoom level (1.0 = no zoom, 2.0 = 2x zoom)

# Initialize Supabase client
print("DEBUG: Startup - Initializing Supabase client...")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
print("DEBUG: Startup - Supabase client initialized.")

# ------------------------------------------------------------------------------
# GPIO pin factory setup (Raspberry Pi OS "Trixie" / Python 3.13 / Pi 4)
# ------------------------------------------------------------------------------
# On Trixie:
#   * pigpio has been dropped from the apt repos entirely (it can't run on a
#     Pi 5, so it was pulled for every board), so gpiozero's automatic
#     fallback to pigpio will always fail here.
#   * the `lgpio` PyPI wheel isn't built for Python 3.13 yet, so
#     `pip install lgpio` tries to compile it from source, which needs swig
#     -- and even after installing swig, the build can still fail.
#
# The reliable fix is to skip pip for the GPIO libraries altogether and use
# the versions Raspberry Pi OS Trixie already ships via apt (precompiled for
# Python 3.13 / aarch64), then point gpiozero directly at lgpio instead of
# letting it probe every backend in turn.
#
# One-time setup on the Pi (run once, outside any venv):
#   sudo apt update
#   sudo apt install python3-lgpio python3-gpiozero
#
# If this script runs inside a virtualenv, it needs to be created (or
# recreated) with access to those system packages:
#   python3 -m venv --system-site-packages venv
#   source venv/bin/activate
#   pip install opencv-python requests pyzbar   # everything EXCEPT gpio libs
#
# Do not pip install lgpio or pigpio -- that's what triggers the swig build.

print("DEBUG: Startup - Setting up GPIO factory...")
try:
    from gpiozero.pins.lgpio import LGPIOFactory
    Device.pin_factory = LGPIOFactory()
except Exception as e:
    print(
        "Warning: could not load the lgpio pin factory (mock mode).\n"
        "  Fix: sudo apt install python3-lgpio python3-gpiozero\n"
        "  If you're in a venv, recreate it with --system-site-packages so "
        "it can see those apt-installed packages.\n"
        f"  Underlying error: {e}"
    )

MIN_PW = 0.0005
MAX_PW = 0.0025

try:
    print("DEBUG: Initializing servos...")
    servo_in = AngularServo(13, min_pulse_width=MIN_PW, max_pulse_width=MAX_PW, initial_angle=0)
    servo_out = AngularServo(19, min_pulse_width=MIN_PW, max_pulse_width=MAX_PW, initial_angle=0)
    
    # Detach servos after a short delay to prevent idle stuttering
    def _detach_servos_init():
        time.sleep(1)
        try:
            servo_in.angle = None
            servo_out.angle = None
            print("DEBUG: Initial servo PWM disabled to prevent idle stuttering")
        except:
            pass
    threading.Thread(target=_detach_servos_init, daemon=True).start()
    
    print("DEBUG: Servos initialized successfully")
    print(f"DEBUG: servo_in type: {type(servo_in)}")
    print(f"DEBUG: servo_out type: {type(servo_out)}")
    print("DEBUG: Servos set to initial position 0 degrees (closed)")
except Exception as e:
    print("Warning: GPIO not available (mock mode).", e)
    class MockServo:
        def __init__(self): 
            self._angle = 0
            print("DEBUG: MockServo initialized")
        @property
        def angle(self):
            return self._angle
        @angle.setter
        def angle(self, value):
            self._angle = value
            print(f"DEBUG: MockServo angle set to {value} degrees")
    servo_in = MockServo()
    servo_out = MockServo()
    print("DEBUG: Using mock servos (motors won't move)")

# ==============================================================================
# STATE & DATA
# ==============================================================================
class GateState:
    SCANNING = "SCANNING"
    DETECTED = "DETECTED"
    INVALID_QR = "INVALID_QR"
    API_ERROR = "API_ERROR"
    WARNING = "WARNING"
    TIMEOUT = "TIMEOUT"
    MANUAL_TYPE = "MANUAL_TYPE"       # Ask: Registered or Guest?
    MANUAL_REG = "MANUAL_REG"         # Ask: Reg ID
    MANUAL_GUEST_IN = "MANUAL_GUEST_IN"   # Ask: Name, Plate, ID Number, Purpose
    MANUAL_GUEST_CONFIRM = "MANUAL_GUEST_CONFIRM"  # Confirm/Reject after filling form
    MANUAL_GUEST_OUT = "MANUAL_GUEST_OUT" # Ask: Search by Name or Plate
    MANUAL_GUEST_SEARCH_RESULT = "MANUAL_GUEST_SEARCH_RESULT"  # Display search result
    GUEST_WARNING = "GUEST_WARNING"
    LOG_WARNING = "LOG_WARNING"  # Same-day double-in or double-out warning
    PROCESSING = "PROCESSING"   # QR detected, waiting for API response
    CAMPUS_FULL = "CAMPUS_FULL"

class SideState:
    def __init__(self, gate_type):
        self.type = gate_type # 'in' or 'out'
        self.state = GateState.SCANNING
        self.data = None # Holds QR text, or vehicle info dict
        self.snapshot = None # Image captured at moment of scan/action
        self.timeout_end = 0
        self.api_error = ""
        self.anomaly_id = None
        self.anomaly_desc = ""
        self.logged_status = None
        self.vehicle_data = {} # Holds vehicle information from separate table
        
        # Manual Form Data
        self.input_field = 0 # which field is active
        self.form_data = ["", "", ""] # e.g. [plate, id_number, purpose] or [plate]
        self.ticket_generated = ""
        self.anim_offset = 0.0 if gate_type == 'in' else 1.5

side_in = SideState('in')
side_out = SideState('out')

global_stats = {"currentlyIn": 0, "visitsToday": 0}
global_logs = []
log_scroll_offset = 0

# ==============================================================================
# SUPABASE HELPERS
# ==============================================================================
def img_to_b64(img):
    if img is None: return None
    _, buffer = cv2.imencode('.jpg', img)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

is_connected = True

class _EmptyResponse:
    data = []

def get_latest_parking_row():
    """Latest parking_availability row for the campus selected at boot.
    'Main' matches 'Main Campus', 'Rnp' matches 'RNP', 'Paseo' matches 'PASEO'."""
    campus = globals().get('SELECTED_CAMPUS')
    if not campus:
        return _EmptyResponse()  # campus not chosen yet (boot screen)
    
    norm_campus = 'Main Campus'
    if 'rnp' in str(campus).lower():
        norm_campus = 'RNP'
    elif 'paseo' in str(campus).lower():
        norm_campus = 'PASEO'
        
    return supabase.table('parking_availability').select('*').ilike('campus', f"%{norm_campus}%").order('date_time', desc=True).limit(1).execute()

def update_parking_availability(action, vehicle_log_id=None):
    """Update parking_availability table in Supabase when vehicle enters or exits"""
    try:
        campus = globals().get('SELECTED_CAMPUS', 'Main')
        norm_campus = 'Main Campus'
        if 'rnp' in str(campus).lower():
            norm_campus = 'RNP'
        elif 'paseo' in str(campus).lower():
            norm_campus = 'PASEO'

        # Get latest settings for this campus
        pa_res = supabase.table('parking_availability').select('*').ilike('campus', f"%{norm_campus}%").order('date_time', desc=True).limit(1).execute()
        capacity = 500
        # Directly count live active entries in vehicle_log for this campus (entries without check_out)
        try:
            active_res = supabase.table('vehicle_log').select('vehicle_log_id').ilike('campus', f"%{campus}%").is_('check_out', 'null').execute()
            new_occupied = len(active_res.data) if active_res.data else 0
        except Exception as e:
            print(f"DEBUG: Error counting live entries: {e}")
            new_occupied = 0

        new_unoccupied = max(0, capacity - new_occupied)

        # Get a valid vehicle_log_id if not provided
        if not vehicle_log_id:
            try:
                vl = supabase.table('vehicle_log').select('vehicle_log_id').order('vehicle_log_id', desc=True).limit(1).execute()
                if vl.data:
                    vehicle_log_id = vl.data[0]['vehicle_log_id']
            except:
                pass

        supabase.table('parking_availability').insert({
            "vehicle_log_id": vehicle_log_id,
            "campus": norm_campus,
            "parking_capacity": capacity,
            "slot_occupied": new_occupied,
            "slot_unoccupied": new_unoccupied,
            "date_time": datetime.now().isoformat()
        }).execute()

        refresh_parking_data()
        print(f"DEBUG: Parking availability updated ({norm_campus}) -> Occupied: {new_occupied}, Available: {new_unoccupied}")
    except Exception as e:
        print(f"DEBUG: Error updating parking availability: {e}")

def refresh_parking_data():
    """Manually refresh parking availability data from database"""
    global global_stats
    try:
        parking_response = get_latest_parking_row()
        if parking_response.data:
            parking_data = parking_response.data[0]
            global_stats['maxCapacity'] = parking_data.get('parking_capacity', -1)
            global_stats['currentlyIn'] = parking_data.get('slot_occupied', 0)
            global_stats['availableSlots'] = parking_data.get('slot_unoccupied', 0)
            print(f"Parking data refreshed: Occupied={global_stats['currentlyIn']}, Available={global_stats['availableSlots']}")
        else:
            print("Parking data refreshed (no parking_availability rows yet)")
    except Exception as e:
        print(f"Error in refresh_parking_data: {e}")

def poll_supabase():
    global global_stats, global_logs, is_connected
    while True:
        try:
            try:
                parking_response = get_latest_parking_row()
                if parking_response.data:
                    parking_data = parking_response.data[0]
                    global_stats['maxCapacity'] = parking_data.get('parking_capacity', -1)
                    global_stats['currentlyIn'] = parking_data.get('slot_occupied', 0)
                    global_stats['availableSlots'] = parking_data.get('slot_unoccupied', 0)
            except Exception as e:
                print(f"Error fetching parking availability: {e}")

            if not is_connected:
                print("Supabase Polling: Connection restored!")
                is_connected = True
        except Exception as e:
            if is_connected:
                print(f"Supabase Polling error: {type(e).__name__}: {e}")
                is_connected = False
        time.sleep(1)  # Reduced from 5 to 1 second for faster real-time updates

print("DEBUG: Startup - Starting Supabase polling thread...")
threading.Thread(target=poll_supabase, daemon=True).start()

# ==============================================================================
# ACTION HANDLERS
# ==============================================================================
def set_servo_angle(servo, target_angle):
    def _move():
        try:
            print(f"DEBUG: Starting servo movement to {target_angle} degrees")
            print(f"DEBUG: Servo object: {servo}")
            print(f"DEBUG: Servo type: {type(servo)}")
            
            # Check if servo is valid
            if servo is None:
                print(f"DEBUG: ERROR - Servo object is None")
                return
            
            # Set the servo angle
            servo.angle = target_angle
            print(f"DEBUG: Servo angle set to {target_angle}")
            
            # Increased sleep time to ensure servo completes movement
            time.sleep(2)
            
            # Set to None to stop PWM pulses, fixing the stuttering issue
            servo.angle = None
            print(f"DEBUG: Servo movement completed, PWM disabled to prevent stuttering")
        except AttributeError as e:
            print(f"DEBUG: Servo AttributeError: {e}")
            print(f"DEBUG: Servo object details: {servo}")
        except Exception as e:
            print(f"DEBUG: Servo movement error: {type(e).__name__}: {e}")
    threading.Thread(target=_move, daemon=True).start()

def open_gate(side):
    print(f"DEBUG: Opening {side.type} gate")
    try:
        servo = servo_in if side.type == 'in' else servo_out
        print(f"DEBUG: Using servo: {servo}")
        print(f"DEBUG: Servo type: {type(servo)}")
        
        if servo is None:
            print(f"DEBUG: ERROR - Servo is None for {side.type} gate")
            side.state = GateState.API_ERROR
            side.api_error = "Servo not available"
            return
        
        set_servo_angle(servo, 90)
        side.state = GateState.TIMEOUT
        side.timeout_end = time.time() + 15  # 15 seconds countdown for normal operations
        print(f"DEBUG: Gate opened, 15-second countdown started")
    except Exception as e:
        print(f"DEBUG: Error in open_gate: {type(e).__name__}: {e}")
        side.state = GateState.API_ERROR
        side.api_error = f"Gate open failed: {str(e)}"

def force_close_gate(side):
    """Force close the gate immediately regardless of state"""
    print(f"DEBUG: Force closing {side.type} gate")
    servo = servo_in if side.type == 'in' else servo_out
    set_servo_angle(servo, 0)
    side.state = GateState.SCANNING
    side.data = None
    side.logged_status = None
    side.timeout_end = 0

def manual_open_gate(side):
    """Manually open gate without database operations - direct motor control only"""
    print(f"DEBUG: Manual open gate for {side.type}")
    servo = servo_in if side.type == 'in' else servo_out
    set_servo_angle(servo, 90)
    side.state = GateState.TIMEOUT
    side.timeout_end = time.time() + 15  # 15 seconds countdown for manual operations
    print(f"DEBUG: Manual gate open complete, 15-second countdown started")

def close_gate(side):
    print(f"DEBUG: Closing {side.type} gate")
    servo = servo_in if side.type == 'in' else servo_out
    set_servo_angle(servo, 0)
    side.state = GateState.SCANNING
    side.data = None
    side.logged_status = None
    print(f"DEBUG: Gate closed successfully")

def process_qr(side, qr_text, frame):
    try:
        # Wait 1 second before capturing snapshot so the QR is fully in frame
        time.sleep(1)
        side.snapshot = frame.copy()
        
        # Look up registration by qr_unique_code in Supabase
        try:
            response = supabase.table('registration').select('*').eq('qr_unique_code', qr_text).execute()
            
            if not response.data:
                side.state = GateState.INVALID_QR
                side.data = qr_text
                return
            
            reg = response.data[0]
            side.data = reg
            
            # Get vehicle information from separate table
            try:
                print(f"DEBUG: Registration data: {reg}")
                vehicle_info_id = reg.get('vehicle_information_id')
                print(f"DEBUG: vehicle_information_id from registration: {vehicle_info_id}")
                
                if vehicle_info_id:
                    vehicle_response = supabase.table('vehicle_information').select('*').eq('vehicle_information_id', vehicle_info_id).execute()
                    print(f"DEBUG: Vehicle response data: {vehicle_response.data}")
                    if vehicle_response.data:
                        vehicle_data = vehicle_response.data[0]
                        # Store vehicle data in a separate field
                        side.vehicle_data = vehicle_data
                        print(f"DEBUG: Vehicle data loaded successfully: {vehicle_data}")
                    else:
                        print(f"DEBUG: No vehicle found with vehicle_information_id: {vehicle_info_id}")
                        side.vehicle_data = {}
                else:
                    print(f"DEBUG: No vehicle_information_id in registration")
                    side.vehicle_data = {}
            except Exception as e:
                print(f"Error fetching vehicle information: {e}")
                side.vehicle_data = {}
            
            # --- Cross-campus check: same QR still recorded as ENTRY (no exit) at ANOTHER campus ---
            try:
                open_res = supabase.table('vehicle_log').select('*').eq('registration_id', reg['registration_id']).is_('check_out', 'null').order('created_at', desc=True).execute()
                for open_row in (open_res.data or []):
                    # Guest/VIP logs use a placeholder registration, so they are not this vehicle
                    if str(open_row.get('logged_status') or '').upper() in ('GUEST', 'VIP'):
                        continue
                    other_campus = str(open_row.get('campus') or '')
                    if SELECTED_CAMPUS.lower() not in other_campus.lower():
                        since = open_row.get('check_in') or ''
                        try:
                            since = datetime.fromisoformat(since.replace('Z', '+00:00')).strftime('%H:%M')
                        except:
                            pass
                        side.logged_status = "REGISTERED"
                        side.anomaly_desc = f"FLAGGED: QR still INSIDE {other_campus} since {since}"
                        side.anomaly_id = open_row.get('vehicle_log_id')
                        print(f"DEBUG: FLAG - QR still recorded as entry at {other_campus} (vehicle_log #{side.anomaly_id})")
                        side.state = GateState.LOG_WARNING
                        return
            except Exception as e:
                print(f"DEBUG: Cross-campus check error: {e}")

            # Get last log for this registration using correct column names
            try:
                last_log_response = supabase.table('vehicle_log').select('*').eq('registration_id', reg['registration_id']).eq('campus', SELECTED_CAMPUS).order('created_at', desc=True).limit(1).execute()
                last_log = last_log_response.data[0] if last_log_response.data else None
            except:
                last_log = None

            # Simple logic: if QR code exists in database, it's REGISTERED
            side.logged_status = "REGISTERED"
            side.status_warning_pending = False

            # --- Same-day log warning check (using check_in/check_out columns) ---
            if last_log:
                if side.type == 'in' and last_log.get('check_in') and not last_log.get('check_out'):
                    # Format timestamp for display
                    check_in_time = last_log['check_in']
                    try:
                        dt = datetime.fromisoformat(check_in_time.replace('Z', '+00:00'))
                        check_in_time = dt.strftime('%H:%M')
                    except:
                        pass
                    side.anomaly_desc = f"Vehicle already IN at {check_in_time}!"
                    side.anomaly_id = last_log.get('vehicle_log_id')
                    side.state = GateState.LOG_WARNING
                    return
                # For exit gate, skip the "already OUT" check to allow multiple exits
                # This makes the exit gate more permissive as requested
            elif side.type == 'out' and not last_log:
                # For exit gate, allow exit even without entry record (more permissive)
                print(f"[{side.type}] No entry record found, but allowing exit anyway")
                # Don't show warning, proceed to automatic opening

            # --- EXIT GATE: Auto-open for valid QR codes ---
            if side.type == 'out':
                # For exit gate, automatically open barrier if no anomalies
                print(f"DEBUG: Exit gate - auto-opening for valid QR")
                submit_entry_exit(side)
                return

            # --- All valid QR codes go to DETECTED state (REGISTERED) ---
            side.state = GateState.DETECTED
            
        except Exception as e:
            side.state = GateState.API_ERROR
            side.api_error = f"Supabase lookup error: {str(e)}"
            side.snapshot = frame.copy()
            
    except Exception as e:
        side.state = GateState.API_ERROR
        side.api_error = str(e)
        side.snapshot = frame.copy()

def submit_entry_exit(side):
    print(f"DEBUG: submit_entry_exit called for {side.type} gate")
    print(f"DEBUG: side.data: {side.data}")
    print(f"DEBUG: side.data type: {type(side.data)}")
    
    # Validate that side.data exists and has required fields
    if side.data is None:
        print(f"DEBUG: ERROR - side.data is None")
        side.state = GateState.API_ERROR
        side.api_error = "No vehicle data available"
        return
    
    if not isinstance(side.data, dict):
        print(f"DEBUG: ERROR - side.data is not a dictionary: {type(side.data)}")
        side.state = GateState.API_ERROR
        side.api_error = "Invalid vehicle data format"
        return
    
    if 'registration_id' not in side.data:
        print(f"DEBUG: ERROR - registration_id not in side.data")
        side.state = GateState.API_ERROR
        side.api_error = "Missing registration ID"
        return
    
    side.state = GateState.PROCESSING
    
    def _run():
        action = 'entry' if side.type == 'in' else 'exit'
        current_time = datetime.now().isoformat()
        
        try:
            vehicle_log_id = None
            if side.type == 'out':
                # Try to find and close the existing open entry log for this registration
                try:
                    open_log_res = supabase.table('vehicle_log').select('*')\
                        .eq('registration_id', side.data['registration_id'])\
                        .ilike('campus', f"%{SELECTED_CAMPUS}%")\
                        .is_('check_out', 'null')\
                        .order('created_at', desc=True)\
                        .limit(1)\
                        .execute()

                    if open_log_res.data:
                        open_log = open_log_res.data[0]
                        vehicle_log_id = open_log['vehicle_log_id']
                        supabase.table('vehicle_log').update({
                            "check_out": current_time,
                            "logged_status": getattr(side, 'logged_status', 'REGISTERED')
                        }).eq('vehicle_log_id', vehicle_log_id).execute()
                        print(f"DEBUG: Closed existing vehicle_log #{vehicle_log_id} on exit")
                except Exception as e:
                    print(f"DEBUG: Error finding/updating open entry log: {e}")

                # Fallback: if no open entry log was found, insert a standalone exit record
                if not vehicle_log_id:
                    log_data = {
                        "vehicle_information_id": side.data.get('vehicle_information_id') or 1,
                        "registration_id": side.data['registration_id'],
                        "check_in": current_time,
                        "check_out": current_time,
                        "logged_status": getattr(side, 'logged_status', 'REGISTERED'),
                        "campus": SELECTED_CAMPUS
                    }
                    res = supabase.table('vehicle_log').insert(log_data).execute()
                    vehicle_log_id = res.data[0]['vehicle_log_id'] if res.data else None
                    print(f"DEBUG: Created standalone exit vehicle_log #{vehicle_log_id}")

                # Update parking availability in DB and refresh stats
                update_parking_availability('out', vehicle_log_id)

            else:
                # ENTRY
                log_data = {
                    "vehicle_information_id": side.data.get('vehicle_information_id') or 1,
                    "registration_id": side.data['registration_id'],
                    "check_in": current_time,
                    "check_out": None,
                    "logged_status": getattr(side, 'logged_status', 'REGISTERED'),
                    "campus": SELECTED_CAMPUS
                }
                res = supabase.table('vehicle_log').insert(log_data).execute()
                vehicle_log_id = res.data[0]['vehicle_log_id'] if res.data else None
                print(f"DEBUG: Created entry vehicle_log #{vehicle_log_id}")

                # Update parking availability in DB and refresh stats
                update_parking_availability('in', vehicle_log_id)

            print(f"DEBUG: {action} log submitted and parking availability updated successfully")
            open_gate(side)

        except Exception as e:
            print(f"DEBUG: Error submitting {action} log: {type(e).__name__}: {e}")
            side.state = GateState.API_ERROR
            side.api_error = f"Submit failed: {str(e)}"
            
    threading.Thread(target=_run, daemon=True).start()

_placeholder_ids = None

def get_placeholder_ids():
    """Find an existing registration row (registration_id, vehicle_information_id)
    to attach VIP/guest logs to, since vehicle_log requires valid foreign keys."""
    global _placeholder_ids
    if _placeholder_ids:
        return _placeholder_ids
    try:
        r = supabase.table('registration').select('registration_id, vehicle_information_id').order('registration_id').limit(1).execute()
        if r.data:
            _placeholder_ids = (r.data[0]['registration_id'], r.data[0]['vehicle_information_id'])
            print(f"DEBUG: Using placeholder IDs for VIP/guest logs: {_placeholder_ids}")
            return _placeholder_ids
        print("DEBUG: No registration rows exist - cannot attach VIP/guest log")
    except Exception as e:
        print(f"DEBUG: Error finding placeholder IDs: {e}")
    return None

def submit_vip(side):
    side.state = GateState.PROCESSING
    def _run():
        current_time = datetime.now().isoformat()
        
        try:
            ids = get_placeholder_ids()
            if ids is None:
                raise Exception("No registration row available to attach VIP log")
            placeholder_reg_id, placeholder_vehicle_id = ids

            # For exit gate, find entry check_in time to avoid null constraint
            if side.type == 'out':
                try:
                    last_log_response = supabase.table('vehicle_log').select('*').eq('registration_id', placeholder_reg_id).eq('campus', SELECTED_CAMPUS).order('created_at', desc=True).limit(1).execute()
                    if last_log_response.data and last_log_response.data[0].get('check_in'):
                        entry_check_in = last_log_response.data[0]['check_in']
                    else:
                        entry_check_in = current_time
                except:
                    entry_check_in = current_time
            else:
                entry_check_in = current_time
            
            log_data = {
                "vehicle_information_id": placeholder_vehicle_id,
                "registration_id": placeholder_reg_id,
                "check_in": entry_check_in,
                "check_out": current_time if side.type == 'out' else None,
                "logged_status": "VIP",
                "campus": SELECTED_CAMPUS  # CAMPUS: tag log with the campus selected at boot
            }
            
            print(f"DEBUG: VIP log data: {log_data}")
            
            vehicle_log_result = supabase.table('vehicle_log').insert(log_data).execute()
            vehicle_log_id = vehicle_log_result.data[0]['vehicle_log_id'] if vehicle_log_result.data else None
            
            vip_data = {
                "vehicle_log_id": vehicle_log_id,
                "name": "VIP Guest",
                "vehicle_plate": "VIP",
                "vip_type": "Emergency Access" if side.form_data[0] == "Override" else "VIP Access",
                "timestamp": current_time
            }
            
            supabase.table('vip_log').insert(vip_data).execute()
            update_parking_availability('in' if side.type == 'in' else 'out', vehicle_log_id)
        except Exception as e:
            # Logging failed, but the gate must still open for VIP access
            print(f"DEBUG: VIP logging failed (opening gate anyway): {type(e).__name__}: {e}")
        
        open_gate(side)

    threading.Thread(target=_run, daemon=True).start()

def check_and_submit_guest(side):
    """Check for guest anomaly before submitting. Shows GUEST_WARNING if found."""
    # Anomaly checks for guests are disabled. Submit directly.
    submit_manual_guest(side)

def submit_manual_guest(side):
    side.state = GateState.PROCESSING
    
    def _run():
        current_time = datetime.now().isoformat()
        
        try:
            if side.type == 'in':
                vehicle_log_id = None
                try:
                    ids = get_placeholder_ids()
                    if ids is None:
                        raise Exception("No registration row available to attach guest log")
                    placeholder_reg_id, placeholder_vehicle_id = ids

                    log_data = {
                        "vehicle_information_id": placeholder_vehicle_id,
                        "registration_id": placeholder_reg_id,
                        "check_in": current_time,
                        "check_out": None,
                        "logged_status": "GUEST",
                        "campus": SELECTED_CAMPUS  # CAMPUS: tag log with the campus selected at boot
                    }
                    
                    vehicle_log_result = supabase.table('vehicle_log').insert(log_data).execute()
                    vehicle_log_id = vehicle_log_result.data[0]['vehicle_log_id'] if vehicle_log_result.data else None
                    
                    guest_data = {
                        "vehicle_log_id": vehicle_log_id,
                        "plate_number": side.form_data[0][:20],
                        "id_number": side.form_data[1][:50],
                        "purpose": side.form_data[2],
                        "timestamp": current_time
                    }
                    
                    supabase.table('guest_log').insert(guest_data).execute()
                except Exception as e:
                    # Logging failed, but the guest must still be let in
                    print(f"DEBUG: Guest logging failed (opening gate anyway): {type(e).__name__}: {e}")
                
                update_parking_availability('in', vehicle_log_id)

                # Open gate automatically with 10 seconds delay (direct servo control)
                servo = servo_in if side.type == 'in' else servo_out
                set_servo_angle(servo, 90)
                side.state = GateState.TIMEOUT
                side.timeout_end = time.time() + 10  # 10 seconds countdown for guest operations
                print(f"DEBUG: Guest gate opened, 10-second countdown started")
            else:
                # Guest exit - find guest by plate and update
                plate_number = side.form_data[0]
                exit_time = datetime.now().isoformat()
                
                # Find the guest log entry
                guest_response = supabase.table('guest_log').select('*').eq('plate_number', plate_number).order('timestamp', desc=True).limit(1).execute()
                
                if guest_response.data:
                    guest_log = guest_response.data[0]
                    vehicle_log_id = guest_log.get('vehicle_log_id')
                    
                    # Update vehicle log with checkout time (check_in already exists from entry)
                    if vehicle_log_id:
                        print(f"DEBUG: Updating guest exit for vehicle_log_id: {vehicle_log_id}")
                        supabase.table('vehicle_log').update({"check_out": exit_time}).eq('vehicle_log_id', vehicle_log_id).execute()
                    
                    update_parking_availability('out', vehicle_log_id)

                    # Open gate with 10 seconds delay (direct servo control)
                    servo = servo_in if side.type == 'in' else servo_out
                    set_servo_angle(servo, 90)
                    side.state = GateState.TIMEOUT
                    side.timeout_end = time.time() + 10  # 10 seconds countdown for guest operations
                    print(f"DEBUG: Guest exit gate opened, 10-second countdown started")
                else:
                    side.state = GateState.API_ERROR
                    side.api_error = "Guest not found"
                
        except Exception as e:
            side.state = GateState.API_ERROR
            side.api_error = f"Manual submit failed: {str(e)}"
            
    threading.Thread(target=_run, daemon=True).start()

def search_guest(side):
    """Search for guest by plate number"""
    search_term = side.form_data[0].strip()
    if not search_term:
        side.state = GateState.API_ERROR
        side.api_error = "Search term cannot be empty"
        return
    
    side.state = GateState.PROCESSING
    
    def _run():
        try:
            # Search guest_log table by plate number in Supabase
            response = supabase.table('guest_log').select('*').eq('plate_number', search_term).order('timestamp', desc=True).limit(5).execute()
            
            if response.data and len(response.data) > 0:
                # Take the most recent guest record
                guest_log = response.data[0]
                
                # Get the associated vehicle log to check if still checked in
                vehicle_log_id = guest_log.get('vehicle_log_id')
                if vehicle_log_id:
                    vehicle_response = supabase.table('vehicle_log').select('*').eq('vehicle_log_id', vehicle_log_id).limit(1).execute()
                    if vehicle_response.data and not vehicle_response.data[0].get('check_out'):
                        # Guest is still checked in
                        side.data = {
                            'plate': guest_log.get('plate_number'),
                            'id_number': guest_log.get('id_number'),
                            'purpose': guest_log.get('purpose'),
                            'timestamp': guest_log.get('timestamp'),
                            'vehicle_log_id': vehicle_log_id
                        }
                        side.state = GateState.MANUAL_GUEST_SEARCH_RESULT
                    else:
                        side.state = GateState.API_ERROR
                        side.api_error = "Guest already checked out"
                else:
                    side.state = GateState.API_ERROR
                    side.api_error = "Invalid guest record"
            else:
                side.state = GateState.API_ERROR
                side.api_error = "No guest found"
        except Exception as e:
            side.state = GateState.API_ERROR
            side.api_error = f"Search failed: {str(e)}"
    
    threading.Thread(target=_run, daemon=True).start()

def submit_guest_exit(side):
    """Submit guest exit and automatically open gate with 10 seconds delay"""
    if not side.data:
        side.state = GateState.API_ERROR
        side.api_error = "No guest data available"
        return
    
    side.state = GateState.PROCESSING
    
    def _run():
        exit_time = datetime.now().isoformat()
        vehicle_log_id = side.data.get('vehicle_log_id')
        
        try:
            # Update vehicle log with checkout time
            if vehicle_log_id:
                supabase.table('vehicle_log').update({"check_out": exit_time}).eq('vehicle_log_id', vehicle_log_id).execute()
                update_parking_availability('out', vehicle_log_id)
                
                # Open gate with 10 seconds delay (direct servo control for guest operations)
                servo = servo_in if side.type == 'in' else servo_out
                set_servo_angle(servo, 90)
                side.state = GateState.TIMEOUT
                side.timeout_end = time.time() + 10  # 10 seconds countdown for guest operations
                print(f"DEBUG: Guest exit gate opened, 10-second countdown started")
            else:
                side.state = GateState.API_ERROR
                side.api_error = "Invalid vehicle log ID"
        except Exception as e:
            side.state = GateState.API_ERROR
            side.api_error = f"Exit failed: {str(e)}"
    
    threading.Thread(target=_run, daemon=True).start()

from pyzbar.pyzbar import decode, ZBarSymbol

# ==============================================================================
# UI RENDERING & MOUSE
# ==============================================================================
W, H = 1280, 720

# Search for the first two valid cameras
# Many USB cameras create two /dev/video nodes (video + metadata).
# We must try reading a frame to ensure it's a usable video node.
print("DEBUG: Startup - Probing for cameras (this might take a while if cameras hang)...")
available_caps = []
for i in range(20): # Probe first 20 indices (Raspberry Pi often uses 10+ for USB cams)
    print(f"DEBUG: Startup - Probing camera index {i}...")
    cap = cv2.VideoCapture(i)
    if cap.isOpened():
        ret, _ = cap.read()
        if ret:
            available_caps.append(cap)
            if len(available_caps) == 2:
                break
        else:
            cap.release()
    else:
        cap.release()

print(f"DEBUG: Startup - Finished probing. Found {len(available_caps)} valid cameras.")
cap1 = available_caps[0] if len(available_caps) > 0 else None
has_cam1 = cap1.isOpened() if cap1 else False
if has_cam1:
    cap1.set(cv2.CAP_PROP_FRAME_WIDTH, W // 2)
    cap1.set(cv2.CAP_PROP_FRAME_HEIGHT, H // 2)

cap2 = available_caps[1] if len(available_caps) > 1 else None
if cap2 and cap2.isOpened():
    cap2.set(cv2.CAP_PROP_FRAME_WIDTH, W // 2)
    cap2.set(cv2.CAP_PROP_FRAME_HEIGHT, H // 2)
    has_dual_cam = True
else:
    has_dual_cam = False
    if cap2:
        cap2.release()

# Helpers for drawing
def apply_zoom(frame, zoom_factor):
    if zoom_factor <= 1.0 or frame is None:
        return frame
    
    h, w = frame.shape[:2]
    new_h, new_w = int(h / zoom_factor), int(w / zoom_factor)
    
    y1 = (h - new_h) // 2
    y2 = y1 + new_h
    x1 = (w - new_w) // 2
    x2 = x1 + new_w
    
    cropped = frame[y1:y2, x1:x2]
    return cv2.resize(cropped, (w, h))

def draw_text(img, text, pos, scale=0.6, color=(255,255,255), thick=1):
    cv2.putText(img, text, pos, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thick)

def draw_btn(img, rect, text, bg_color=(50,200,50)):
    x1, y1, w, h = rect
    cv2.rectangle(img, (x1, y1), (x1+w, y1+h), bg_color, -1)
    draw_text(img, text, (x1+10, y1+30), 0.7, (255,255,255), 2)

def in_rect(x, y, rect):
    rx, ry, rw, rh = rect
    return rx <= x <= rx+rw and ry <= y <= ry+rh

def render_side_dashboard(img):
    """Render the stats dashboard with parking_availability data"""
    cv2.rectangle(img, (0, H//2), (W//2, H), (40,40,40), -1)
    draw_text(img, "STATS DASHBOARD", (20, H//2 + 40), 1.0, (200,200,200), 2)
    
    max_cap = global_stats.get('maxCapacity', -1)
    cap_str = str(max_cap) if max_cap != -1 else "No Limit"
    currently_in = global_stats.get('currentlyIn', 0)
    available_slots = global_stats.get('availableSlots', 0)
    
    # Display only the three required metrics
    draw_text(img, f"Total Capacity: {cap_str}", (20, H//2 + 100), 1.0, (255, 255, 255))
    draw_text(img, f"Currently In: {currently_in}", (20, H//2 + 150), 1.0, (0, 255, 0))
    draw_text(img, f"Available Slots: {available_slots}", (20, H//2 + 200), 1.0, (0, 200, 255))
    
    draw_btn(img, (20, H - 60, 100, 40), "REFRESH", (50, 150, 200))

def render_side(img, side, offset_x):
    # Base layout
    cx = offset_x
    title = "ENTRANCE" if side.type == 'in' else "EXIT"
    draw_text(img, title, (cx + 10, 30), 1.0, (0, 255, 255), 2)

    # State machine UI
    if side.state == GateState.SCANNING:
        # Scanning animation line (sweeping up and down)
        cycle_duration = 3.0
        t = (time.time() + side.anim_offset) % cycle_duration
        progress = (t / (cycle_duration / 2)) if t < (cycle_duration / 2) else (2.0 - t / (cycle_duration / 2))
        line_y = int(progress * (H // 2 - 10)) + 5 # Keep it slightly within bounds
        cv2.line(img, (cx, line_y), (cx + W//2, line_y), (0, 255, 0), 2)
        
        # Transparent glow effect
        overlay = img.copy()
        cv2.rectangle(overlay, (cx, max(0, line_y - 30)), (cx + W//2, line_y), (0, 255, 0), -1)
        cv2.addWeighted(overlay, 0.2, img, 0.8, 0, img)

        draw_text(img, "No QR Code Detected", (cx + 20, 80), 0.8, (0, 255, 255), 2)
        draw_text(img, "Hold QR code anywhere in this area", (cx + 20, 110), 0.6)
        draw_btn(img, (cx + W//2 - 160, H//2 - 60, 150, 50), "MANUAL OPEN", (0,140,255))

        if side.type == 'in':
            max_cap = global_stats.get('maxCapacity', -1)
            curr_in = global_stats.get('currentlyIn', 0)
            if max_cap != -1 and curr_in >= max_cap:
                side.state = GateState.CAMPUS_FULL
    
    elif side.state == GateState.DETECTED:
        # Access vehicle information from separate table
        vehicle_data = getattr(side, 'vehicle_data', {})
        
        # Debug print to check vehicle data
        if not vehicle_data:
            print(f"DEBUG: No vehicle_data for {side.type} gate, attempting to fetch again")
            # Try to fetch vehicle data again if missing
            try:
                vehicle_info_id = side.data.get('vehicle_information_id')
                if vehicle_info_id:
                    vehicle_response = supabase.table('vehicle_information').select('*').eq('vehicle_information_id', vehicle_info_id).execute()
                    if vehicle_response.data:
                        side.vehicle_data = vehicle_response.data[0]
                        vehicle_data = side.vehicle_data
                        print(f"DEBUG: Re-fetched vehicle data: {vehicle_data}")
            except Exception as e:
                print(f"DEBUG: Error re-fetching vehicle data: {e}")
        
        # Display role, campus, plate number, and color
        draw_text(img, f"Role: {side.data.get('role', 'N/A')}", (cx + 20, 80), 0.8)
        draw_text(img, f"Campus: {side.data.get('campus', 'N/A')}", (cx + 20, 110), 0.8)
        
        # Access vehicle information for plate number and color
        vehicle_plate = vehicle_data.get('plate_number', 'N/A') if vehicle_data else 'N/A'
        vehicle_color = vehicle_data.get('color', 'N/A') if vehicle_data else 'N/A'
        vehicle_brand = vehicle_data.get('brand', 'N/A') if vehicle_data else 'N/A'
        
        draw_text(img, f"Plate: {vehicle_plate}", (cx + 20, 140), 0.8)
        draw_text(img, f"Color: {vehicle_color}", (cx + 20, 170), 0.8)
        draw_text(img, f"Brand: {vehicle_brand}", (cx + 20, 200), 0.8)
        
        # Display the actual logged status
        status_text = getattr(side, 'logged_status', 'UNKNOWN')
        if status_text == "REGISTERED":
            draw_text(img, f"STATUS: {status_text}", (cx + 20, 230), 0.8, (0, 255, 0), 2)
        else:
            draw_text(img, f"STATUS: {status_text}", (cx + 20, 230), 0.8, (0, 165, 255), 2)
        
        btn_text = "LET IN" if side.type == 'in' else "LET OUT"
        draw_btn(img, (cx + 20, H//2 - 70, 120, 50), btn_text)
        draw_btn(img, (cx + 150, H//2 - 70, 100, 50), "SKIP", (0,0,200))
        
    elif side.state == GateState.INVALID_QR:
        draw_text(img, "INVALID QR CODE", (cx + 20, 80), 0.8, (0,0,255), 2)
        draw_text(img, f"Content: {side.data[:20]}...", (cx + 20, 110), 0.6)
        draw_text(img, "Not a recognized registration.", (cx + 20, 140), 0.6)
        draw_btn(img, (cx + 20, H//2 - 70, 180, 50), "OPEN MANUALLY", (0,140,255))
        draw_btn(img, (cx + 210, H//2 - 70, 100, 50), "DISMISS", (100,100,100))
        
    elif side.state == GateState.WARNING:
        draw_text(img, "ANOMALY WARNING", (cx + 20, 80), 0.8, (0,165,255), 2)
        draw_text(img, side.anomaly_desc, (cx + 20, 110), 0.6)
        draw_btn(img, (cx + 20, H//2 - 70, 250, 50), "ACKNOWLEDGE & PROCEED", (0,140,255))
        draw_btn(img, (cx + 280, H//2 - 70, 100, 50), "SKIP", (0,0,200))
        
    elif side.state == GateState.LOG_WARNING:
        # Bold red warning for same-day double-in / double-out
        draw_text(img, "!! LOG WARNING !!", (cx + 20, 60), 1.0, (0, 0, 255), 3)
        draw_text(img, side.anomaly_desc[:55], (cx + 20, 105), 0.65, (0, 100, 255), 2)
        btn_text = "PROCEED ANYWAY" if side.type == 'in' else "PROCEED ANYWAY"
        draw_btn(img, (cx + 20, H//2 - 70, 200, 50), btn_text, (0, 140, 255))
        draw_btn(img, (cx + 230, H//2 - 70, 100, 50), "SKIP", (0, 0, 200))

    elif side.state == GateState.API_ERROR:
        draw_text(img, "API ERROR", (cx + 20, 80), 0.8, (0,0,255), 2)
        draw_text(img, side.api_error[:40], (cx + 20, 110), 0.6)
        draw_btn(img, (cx + 20, H//2 - 70, 180, 50), "OPEN MANUALLY", (0,140,255))
        draw_btn(img, (cx + 210, H//2 - 70, 100, 50), "DISMISS", (100,100,100))

    elif side.state == GateState.TIMEOUT:
        rem = max(0, int(side.timeout_end - time.time()))
        draw_text(img, f"GATE OPEN - Closing in {rem}s", (cx + 20, 150), 1.0, (0,255,0), 2)
        if side.type == 'out':
            draw_text(img, "Scan QR to refresh timer", (cx + 20, 180), 0.6, (200, 200, 200))
        draw_btn(img, (cx + 20, H//2 - 70, 150, 50), "FORCE CLOSE", (0,0,200))
        if rem == 0: force_close_gate(side)
        
    elif side.state == GateState.CAMPUS_FULL:
        draw_text(img, "CAMPUS FULL", (cx + 20, 80), 1.0, (0,0,255), 3)
        max_cap = global_stats.get('maxCapacity', -1)
        cap_str = str(max_cap) if max_cap != -1 else "No Limit"
        currently_in = global_stats.get('currentlyIn', 0)
        available_slots = global_stats.get('availableSlots', 0)
        
        draw_text(img, f"Total Capacity: {cap_str}", (cx + 20, 120), 0.7)
        draw_text(img, f"Currently In: {currently_in}", (cx + 20, 150), 0.7)
        draw_text(img, f"Available Slots: {available_slots}", (cx + 20, 180), 0.7, (0, 200, 255))
        draw_btn(img, (cx + 20, H//2 - 70, 230, 50), "OVERRIDE (LET IN)", (0,140,255))
        draw_btn(img, (cx + 260, H//2 - 70, 150, 50), "VIP ACCESS", (200,50,200))
        
        # Check if capacity clears
        if max_cap == -1 or currently_in < max_cap:
            side.state = GateState.SCANNING

    elif side.state == GateState.MANUAL_TYPE:
        draw_text(img, "MANUAL ENTRY", (cx + 20, 80), 0.8, (255,255,255), 2)
        draw_btn(img, (cx + 20, 110, 120, 50), "REG ID", (150,100,50))
        draw_btn(img, (cx + 150, 110, 100, 50), "GUEST", (100,150,50))
        draw_btn(img, (cx + 260, 110, 150, 50), "VIP ACCESS", (200,50,200))
        draw_btn(img, (cx + 20, H//2 - 70, 100, 50), "CANCEL", (100,100,100))
        
    elif side.state == GateState.MANUAL_REG:
        draw_text(img, "ENTER REG ID (Type on keyboard)", (cx + 20, 80), 0.7)
        cv2.rectangle(img, (cx + 20, 100), (cx + 300, 140), (255,255,255), 1)
        draw_text(img, side.form_data[0] + "_", (cx + 30, 125), 0.7)
        draw_btn(img, (cx + 20, H//2 - 70, 120, 50), "LOOKUP", (50,200,50))
        draw_btn(img, (cx + 150, H//2 - 70, 100, 50), "CANCEL", (100,100,100))
        
    elif side.state == GateState.MANUAL_GUEST_IN:
        draw_text(img, "GUEST IN (Type on keyboard & Click field)", (cx + 20, 40), 0.6)
        
        c1 = (255,255,0) if side.input_field == 0 else (255,255,255)
        draw_text(img, "Plate Number:", (cx + 20, 70), 0.6, c1)
        cv2.rectangle(img, (cx + 130, 50), (cx + 400, 80), c1, 1)
        draw_text(img, side.form_data[0] + ("_" if side.input_field==0 else ""), (cx + 135, 70), 0.6)
        
        c2 = (255,255,0) if side.input_field == 1 else (255,255,255)
        draw_text(img, "ID Number:", (cx + 20, 100), 0.6, c2)
        cv2.rectangle(img, (cx + 130, 80), (cx + 400, 110), c2, 1)
        draw_text(img, side.form_data[1] + ("_" if side.input_field==1 else ""), (cx + 135, 100), 0.6)
        
        c3 = (255,255,0) if side.input_field == 2 else (255,255,255)
        draw_text(img, "Purpose:", (cx + 20, 130), 0.6, c3)
        cv2.rectangle(img, (cx + 130, 110), (cx + 400, 140), c3, 1)
        draw_text(img, side.form_data[2] + ("_" if side.input_field==2 else ""), (cx + 135, 130), 0.6)
        
        draw_btn(img, (cx + 20, H//2 - 70, 120, 50), "CONFIRM", (50,200,50))
        draw_btn(img, (cx + 150, H//2 - 70, 100, 50), "CANCEL", (100,100,100))

    elif side.state == GateState.MANUAL_GUEST_CONFIRM:
        draw_text(img, "CONFIRM GUEST ENTRY", (cx + 20, 60), 0.8, (0, 255, 255), 2)
        draw_text(img, f"Plate: {side.form_data[0]}", (cx + 20, 90), 0.7)
        draw_text(img, f"ID Number: {side.form_data[1]}", (cx + 20, 110), 0.7)
        draw_text(img, f"Purpose: {side.form_data[2]}", (cx + 20, 130), 0.7)
        draw_btn(img, (cx + 20, H//2 - 70, 120, 50), "PROCEED", (50,200,50))
        draw_btn(img, (cx + 150, H//2 - 70, 100, 50), "REJECT", (0,0,200))
    
    elif side.state == GateState.MANUAL_GUEST_OUT:
        draw_text(img, "GUEST OUT - SEARCH GUEST", (cx + 20, 60), 0.7, (0, 255, 255), 2)
        draw_text(img, "Enter Plate Number:", (cx + 20, 90), 0.6)
        cv2.rectangle(img, (cx + 20, 100), (cx + 300, 140), (255,255,255), 1)
        draw_text(img, side.form_data[0] + "_", (cx + 30, 125), 0.7)
        draw_btn(img, (cx + 20, H//2 - 70, 120, 50), "SEARCH", (50,200,50))
        draw_btn(img, (cx + 150, H//2 - 70, 100, 50), "CANCEL", (100,100,100))
    
    elif side.state == GateState.MANUAL_GUEST_SEARCH_RESULT:
        draw_text(img, "GUEST RECORD FOUND", (cx + 20, 60), 0.8, (0, 255, 0), 2)
        if side.data:
            draw_text(img, f"Plate: {side.data.get('plate', 'N/A')}", (cx + 20, 90), 0.7)
            draw_text(img, f"ID: {side.data.get('id_number', 'N/A')}", (cx + 20, 110), 0.7)
            draw_text(img, f"Purpose: {side.data.get('purpose', 'N/A')}", (cx + 20, 130), 0.7)
            # Format entry time
            entry_time = side.data.get('timestamp', 'N/A')
            if entry_time and entry_time != 'N/A':
                try:
                    dt = datetime.fromisoformat(entry_time.replace('Z', '+00:00'))
                    entry_time = dt.strftime('%H:%M')
                except:
                    pass
            draw_text(img, f"Entry Time: {entry_time}", (cx + 20, 150), 0.6)
        draw_btn(img, (cx + 20, H//2 - 70, 120, 50), "EXIT", (50,200,50))
        draw_btn(img, (cx + 150, H//2 - 70, 100, 50), "CANCEL", (100,100,100))
    
    elif side.state == GateState.GUEST_WARNING:
        draw_text(img, "GUEST ANOMALY", (cx + 20, 80), 0.8, (0,165,255), 2)
        draw_text(img, side.anomaly_desc[:55], (cx + 20, 110), 0.55, (0,200,255))
        draw_btn(img, (cx + 20, H//2 - 70, 250, 50), "ACKNOWLEDGE & PROCEED", (0,140,255))
        draw_btn(img, (cx + 280, H//2 - 70, 100, 50), "SKIP", (0,0,200))

def mouse_callback(event, x, y, flags, param):
    global log_scroll_offset  # FIX: without this, mouse-wheel scrolling raised UnboundLocalError
    global BACK_TO_CAMPUS
    
    if event == cv2.EVENT_MOUSEWHEEL:
        if x > W//2 and y > H//2: # Only scroll if hovering over logs area
            max_visible = 8
            max_offset = max(0, len(global_logs) - max_visible)
            if flags > 0: # Scroll up
                log_scroll_offset = max(0, log_scroll_offset - 1)
            else: # Scroll down
                log_scroll_offset = min(max_offset, log_scroll_offset + 1)
        return
        
    if event != cv2.EVENT_LBUTTONDOWN: return
    
    # Bottom Left - Refresh
    if in_rect(x, y, (20, H - 60, 100, 40)):
        print("Refresh clicked - updating parking availability data")
        refresh_parking_data()
        return
        
    # Bottom Left - BACK to campus selection (only when both gates are idle)
    if in_rect(x, y, (130, H - 60, 100, 40)):
        if side_in.state == GateState.SCANNING and side_out.state == GateState.SCANNING:
            print("DEBUG: BACK clicked - returning to campus selection")
            BACK_TO_CAMPUS = True
        return

    # Check sides
    for side, cx in [(side_in, 0), (side_out, W//2)]:
        if y > H//2: continue # Only top half has buttons
        
        if side.state == GateState.SCANNING:
            if in_rect(x, y, (cx + W//2 - 160, H//2 - 60, 150, 50)):
                side.state = GateState.MANUAL_TYPE
                side.form_data = ["", "", ""]
                side.snapshot = getattr(side, 'latest_crop', None)
        
        elif side.state == GateState.DETECTED:
            if in_rect(x, y, (cx + 20, H//2 - 70, 120, 50)):
                print(f"DEBUG: LET IN button clicked for {side.type}")
                submit_entry_exit(side)
            elif in_rect(x, y, (cx + 150, H//2 - 70, 100, 50)):
                close_gate(side)
                
        elif side.state == GateState.INVALID_QR or side.state == GateState.API_ERROR:
            if in_rect(x, y, (cx + 20, H//2 - 70, 180, 50)): # MANUAL OPEN
                print(f"DEBUG: Manual open button clicked for {side.type}")
                manual_open_gate(side)  # Direct motor control without database
            elif in_rect(x, y, (cx + 210, H//2 - 70, 100, 50)): # DISMISS
                close_gate(side)
                
        elif side.state == GateState.WARNING:
            if in_rect(x, y, (cx + 20, H//2 - 70, 250, 50)):
                submit_entry_exit(side)
            elif in_rect(x, y, (cx + 280, H//2 - 70, 100, 50)):
                close_gate(side)

        elif side.state == GateState.LOG_WARNING:
            if in_rect(x, y, (cx + 20, H//2 - 70, 200, 50)):  # PROCEED ANYWAY
                side.state = GateState.DETECTED
            elif in_rect(x, y, (cx + 230, H//2 - 70, 100, 50)):  # SKIP
                close_gate(side)
                
        elif side.state == GateState.TIMEOUT:
            if in_rect(x, y, (cx + 20, H//2 - 70, 150, 50)):
                force_close_gate(side)
                
        elif side.state == GateState.CAMPUS_FULL:
            if in_rect(x, y, (cx + 20, H//2 - 70, 230, 50)):
                side.form_data = ["Override", "N/A", "Campus Full Override"]
                if side.form_data[0] == "VIP":
                    submit_vip(side)
                else:
                    submit_manual_guest(side)
            elif in_rect(x, y, (cx + 260, H//2 - 70, 150, 50)):
                side.form_data = ["VIP", "VIP", "VIP Access"]
                submit_vip(side)
                
        elif side.state == GateState.MANUAL_TYPE:
            if in_rect(x, y, (cx + 20, 110, 120, 50)): # REG
                side.state = GateState.MANUAL_REG
            elif in_rect(x, y, (cx + 150, 110, 100, 50)): # GUEST
                side.state = GateState.MANUAL_GUEST_IN if side.type == 'in' else GateState.MANUAL_GUEST_OUT
            elif in_rect(x, y, (cx + 260, 110, 150, 50)): # VIP
                side.form_data = ["VIP", "VIP", "VIP Access"]
                submit_vip(side)
            elif in_rect(x, y, (cx + 20, H//2 - 70, 100, 50)):
                close_gate(side)
                
        elif side.state == GateState.MANUAL_REG:
            if in_rect(x, y, (cx + 20, H//2 - 70, 120, 50)): # LOOKUP
                # Look up by registration ID directly
                reg_id = side.form_data[0].strip()
                if reg_id:
                    try:
                        response = supabase.table('registration').select('*').eq('registration_id', reg_id).execute()
                        if response.data:
                            reg = response.data[0]
                            side.data = reg
                            side.snapshot = side.snapshot if side.snapshot is not None else np.zeros((H//2, W//2, 3), dtype=np.uint8)
                            side.logged_status = "REGISTERED"
                            
                            # Fetch vehicle information from separate table
                            try:
                                print(f"DEBUG (Manual lookup): Registration data: {reg}")
                                vehicle_info_id = reg.get('vehicle_information_id')
                                print(f"DEBUG (Manual lookup): vehicle_information_id: {vehicle_info_id}")
                                
                                if vehicle_info_id:
                                    vehicle_response = supabase.table('vehicle_information').select('*').eq('vehicle_information_id', vehicle_info_id).execute()
                                    print(f"DEBUG (Manual lookup): Vehicle response: {vehicle_response.data}")
                                    if vehicle_response.data:
                                        side.vehicle_data = vehicle_response.data[0]
                                        print(f"DEBUG (Manual lookup): Vehicle data loaded: {side.vehicle_data}")
                                    else:
                                        print(f"DEBUG (Manual lookup): No vehicle found with ID: {vehicle_info_id}")
                                        side.vehicle_data = {}
                                else:
                                    print(f"DEBUG (Manual lookup): No vehicle_information_id in registration")
                                    side.vehicle_data = {}
                            except Exception as e:
                                print(f"DEBUG (Manual lookup): Error fetching vehicle information: {e}")
                                side.vehicle_data = {}
                            
                            # Get last log for this registration using correct column names
                            try:
                                last_log_response = supabase.table('vehicle_log').select('*').eq('registration_id', reg['registration_id']).eq('campus', SELECTED_CAMPUS).order('created_at', desc=True).limit(1).execute()
                                last_log = last_log_response.data[0] if last_log_response.data else None
                            except:
                                last_log = None

                            # Simple logic: if registration exists in database, it's REGISTERED
                            side.logged_status = "REGISTERED"
                            side.status_warning_pending = False

                            # Check for same-day log warning (using check_in/check_out columns)
                            if last_log:
                                if side.type == 'in' and last_log.get('check_in') and not last_log.get('check_out'):
                                    # Format timestamp for display
                                    check_in_time = last_log['check_in']
                                    try:
                                        dt = datetime.fromisoformat(check_in_time.replace('Z', '+00:00'))
                                        check_in_time = dt.strftime('%H:%M')
                                    except:
                                        pass
                                    side.anomaly_desc = f"Vehicle already IN at {check_in_time}!"
                                    side.anomaly_id = last_log.get('vehicle_log_id')
                                    side.state = GateState.LOG_WARNING
                                elif side.type == 'out' and last_log.get('check_out') and not last_log.get('check_in'):
                                    # Format timestamp for display
                                    check_out_time = last_log['check_out']
                                    try:
                                        dt = datetime.fromisoformat(check_out_time.replace('Z', '+00:00'))
                                        check_out_time = dt.strftime('%H:%M')
                                    except:
                                        pass
                                    side.anomaly_desc = f"Vehicle already OUT at {check_out_time}!"
                                    side.anomaly_id = last_log.get('vehicle_log_id')
                                    side.state = GateState.LOG_WARNING
                                else:
                                    side.state = GateState.DETECTED
                            else:
                                side.state = GateState.DETECTED
                        else:
                            side.state = GateState.INVALID_QR
                            side.data = reg_id
                    except Exception as e:
                        side.state = GateState.API_ERROR
                        side.api_error = f"Lookup failed: {str(e)}"
            elif in_rect(x, y, (cx + 150, H//2 - 70, 100, 50)):
                close_gate(side)
                
        elif side.state == GateState.MANUAL_GUEST_IN:
            if in_rect(x, y, (cx + 130, 50, 270, 30)): side.input_field = 0
            elif in_rect(x, y, (cx + 130, 80, 270, 30)): side.input_field = 1
            elif in_rect(x, y, (cx + 130, 110, 270, 30)): side.input_field = 2
            elif in_rect(x, y, (cx + 20, H//2 - 70, 120, 50)):
                # Move to confirm screen
                side.state = GateState.MANUAL_GUEST_CONFIRM
            elif in_rect(x, y, (cx + 150, H//2 - 70, 100, 50)):
                close_gate(side)
        
        elif side.state == GateState.MANUAL_GUEST_CONFIRM:
            if in_rect(x, y, (cx + 20, H//2 - 70, 120, 50)):
                # Proceed with manual guest entry
                if side.form_data[0] == "VIP":
                    submit_vip(side)
                else:
                    submit_manual_guest(side)
            elif in_rect(x, y, (cx + 150, H//2 - 70, 100, 50)):
                # Reject - go back to entry form
                side.state = GateState.MANUAL_GUEST_IN
                side.form_data = ["", "", ""]
                
        elif side.state == GateState.MANUAL_GUEST_OUT:
            if in_rect(x, y, (cx + 20, H//2 - 70, 120, 50)):
                # Search for guest by name or plate
                search_guest(side)
            elif in_rect(x, y, (cx + 150, H//2 - 70, 100, 50)):
                close_gate(side)
        
        elif side.state == GateState.MANUAL_GUEST_SEARCH_RESULT:
            if in_rect(x, y, (cx + 20, H//2 - 70, 120, 50)):
                # Exit guest - open gate automatically
                submit_guest_exit(side)
            elif in_rect(x, y, (cx + 150, H//2 - 70, 100, 50)):
                close_gate(side)
                
        elif side.state == GateState.GUEST_WARNING:
            if in_rect(x, y, (cx + 20, H//2 - 70, 250, 50)):
                if side.form_data[0] == "VIP":
                    submit_vip(side)
                else:
                    submit_manual_guest(side)
            elif in_rect(x, y, (cx + 280, H//2 - 70, 100, 50)):
                close_gate(side)


print("DEBUG: Startup - Creating UI window...")
cv2.namedWindow("GateQR Dashboard", cv2.WINDOW_NORMAL)
cv2.setWindowProperty("GateQR Dashboard", cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

# ==============================================================================
# CAMPUS SELECTION (runs once at boot, before scanning starts)
# ==============================================================================
SELECTED_CAMPUS = None
CAMPUS_OPTIONS = ["Main", "Rnp", "Paseo"]
campus_btns = [(W//2 - 150, 220 + i*110, 300, 80) for i in range(len(CAMPUS_OPTIONS))]

def campus_mouse_callback(event, x, y, flags, param):
    global SELECTED_CAMPUS
    if event != cv2.EVENT_LBUTTONDOWN: return
    for name, rect in zip(CAMPUS_OPTIONS, campus_btns):
        if in_rect(x, y, rect):
            SELECTED_CAMPUS = name
            print(f"DEBUG: Campus selected: {SELECTED_CAMPUS}")

cv2.setMouseCallback("GateQR Dashboard", campus_mouse_callback)
print("DEBUG: Startup - Waiting for campus selection...")
while SELECTED_CAMPUS is None:
    screen = np.full((H, W, 3), (30, 30, 30), dtype=np.uint8)
    draw_text(screen, "SELECT CAMPUS", (W//2 - 150, 120), 1.2, (0, 255, 255), 3)
    draw_text(screen, "Tap a campus to start scanning", (W//2 - 190, 170), 0.8, (200, 200, 200), 2)
    for name, rect in zip(CAMPUS_OPTIONS, campus_btns):
        draw_btn(screen, rect, "", (50, 150, 200))
        draw_text(screen, name.upper(), (rect[0] + 90, rect[1] + 52), 1.1, (255, 255, 255), 2)
    cv2.imshow("GateQR Dashboard", screen)
    if cv2.waitKey(30) & 0xFF == 27:  # ESC to quit
        if cap1 is not None: cap1.release()
        if has_dual_cam and cap2 is not None: cap2.release()
        cv2.destroyAllWindows()
        raise SystemExit

# Campus chosen -> hand the mouse over to the normal gate UI
cv2.setMouseCallback("GateQR Dashboard", mouse_callback)

# ==============================================================================
# BACK BUTTON -> CHOOSE CAMPUS AGAIN
# ==============================================================================
BACK_TO_CAMPUS = False

def reselect_campus():
    """Show the campus selection screen again, then return to the gate UI."""
    global SELECTED_CAMPUS
    SELECTED_CAMPUS = None
    # Clear stats from the previous campus; the poller reloads them for the new one
    global_stats.clear()
    global_stats.update({"currentlyIn": 0, "visitsToday": 0})
    cv2.setMouseCallback("GateQR Dashboard", campus_mouse_callback)
    print("DEBUG: Waiting for campus selection (BACK)...")
    while SELECTED_CAMPUS is None:
        screen = np.full((H, W, 3), (30, 30, 30), dtype=np.uint8)
        draw_text(screen, "SELECT CAMPUS", (W//2 - 150, 120), 1.2, (0, 255, 255), 3)
        draw_text(screen, "Tap a campus to start scanning", (W//2 - 190, 170), 0.8, (200, 200, 200), 2)
        for name, rect in zip(CAMPUS_OPTIONS, campus_btns):
            draw_btn(screen, rect, "", (50, 150, 200))
            draw_text(screen, name.upper(), (rect[0] + 90, rect[1] + 52), 1.1, (255, 255, 255), 2)
        cv2.imshow("GateQR Dashboard", screen)
        if cv2.waitKey(30) & 0xFF == 27:  # ESC to quit
            if cap1 is not None: cap1.release()
            if has_dual_cam and cap2 is not None: cap2.release()
            cv2.destroyAllWindows()
            raise SystemExit
    cv2.setMouseCallback("GateQR Dashboard", mouse_callback)

# Seconds a QR must be out of the camera's view before it counts as a NEW scan during the exit countdown
QR_REPEAT_GAP = 4

print("DEBUG: Startup - Entering main loop...")
while True:
    if BACK_TO_CAMPUS:
        BACK_TO_CAMPUS = False
        reselect_campus()
        continue

    if has_dual_cam:
        ret1, frame1 = cap1.read()
        ret2, frame2 = cap2.read()
        if not ret1 or not ret2: break
        
        frame1 = apply_zoom(frame1, CAMERA_ZOOM)
        frame2 = apply_zoom(frame2, CAMERA_ZOOM)
        
        frame1 = cv2.resize(frame1, (W//2, H//2))
        frame2 = cv2.resize(frame2, (W//2, H//2))
        
        display = cv2.resize(frame1, (W, H)) # base
        display[0:H//2, 0:W//2] = frame1
        display[0:H//2, W//2:W] = frame2
        display[H//2:H, 0:W] = (30,30,30)

        crops = [(side_in, 0, frame1), (side_out, W//2, frame2)]
    else:
        if has_cam1:
            ret, frame = cap1.read()
            if not ret: break
            frame = apply_zoom(frame, CAMERA_ZOOM)
        else:
            frame = np.zeros((H, W, 3), dtype=np.uint8)
            cv2.putText(frame, "NO CAMERA DETECTED (MOCK PREVIEW)", (W//2 - 250, H//2 - 20), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            time.sleep(0.05)
            
        frame = cv2.resize(frame, (W, H//2))
        
        display = cv2.resize(frame, (W, H))
        display[0:H//2, 0:W] = frame
        display[H//2:H, 0:W] = (30,30,30)

        crops = [(side_in, 0, frame[:, 0:W//2]), (side_out, W//2, frame[:, W//2:W])]

    # Process QR for both sides if scanning
    for side, cx, crop in crops:
        side.latest_crop = crop.copy()
        # Gate just opened: the QR that opened it may still be in view, so start ignoring it from now
        if side.state != GateState.TIMEOUT:
            side._timeout_armed = False
        elif not getattr(side, '_timeout_armed', False):
            side._timeout_armed = True
            side.last_qr_time = time.time()
        if side.state == GateState.SCANNING:
            decoded_objects = decode(crop, symbols=[ZBarSymbol.QRCODE])
            if decoded_objects:
                data = decoded_objects[0].data.decode("utf-8")
                print(f"[{side.type}] QR: {data}")
                side.state = GateState.PROCESSING  # Block re-trigger immediately
                side.last_qr = data  # remember the QR that opens this gate
                crop_copy = crop.copy()
                threading.Thread(target=process_qr, args=(side, data, crop_copy), daemon=True).start()
        elif side.state == GateState.TIMEOUT and side.type == 'out':
            # For exit gate, keep scanning while the barrier is open: every NEW QR resets the countdown to 15s
            decoded_objects = decode(crop, symbols=[ZBarSymbol.QRCODE])
            # Same QR still in front of the camera (e.g. the one that opened the gate) -> ignore it
            if decoded_objects:
                _seen = decoded_objects[0].data.decode("utf-8")
                _now = time.time()
                _repeat = (_seen == getattr(side, 'last_qr', None) and _now - getattr(side, 'last_qr_time', 0) < QR_REPEAT_GAP)
                side.last_qr_time = _now
                if _repeat:
                    decoded_objects = []
            if decoded_objects:
                data = decoded_objects[0].data.decode("utf-8")
                side.last_qr = data
                print(f"[{side.type}] New QR detected during countdown: {data}")
                # Process the QR to log the exit (but don't open gate again since it's already open)
                side.snapshot = crop.copy()
                def _log_exit(data=data, side=side):
                    try:
                        # Look up registration by qr_unique_code
                        response = supabase.table('registration').select('*').eq('qr_unique_code', data).execute()
                        if response.data:
                            # Valid QR scanned during the countdown -> reset the countdown to 15 seconds
                            side.timeout_end = time.time() + 15
                            print(f"[{side.type}] Countdown reset to 15s")
                            reg = response.data[0]
                            current_time = datetime.now().isoformat()
                            vehicle_log_id = None
                            
                            # Find and close the existing open entry log
                            try:
                                open_log_res = supabase.table('vehicle_log').select('*')\
                                    .eq('registration_id', reg['registration_id'])\
                                    .ilike('campus', f"%{SELECTED_CAMPUS}%")\
                                    .is_('check_out', 'null')\
                                    .order('created_at', desc=True)\
                                    .limit(1)\
                                    .execute()

                                if open_log_res.data:
                                    open_log = open_log_res.data[0]
                                    vehicle_log_id = open_log['vehicle_log_id']
                                    supabase.table('vehicle_log').update({
                                        "check_out": current_time,
                                        "logged_status": "REGISTERED"
                                    }).eq('vehicle_log_id', vehicle_log_id).execute()
                            except Exception as e:
                                print(f"DEBUG: Error updating open entry during countdown: {e}")

                            if not vehicle_log_id:
                                log_data = {
                                    "vehicle_information_id": reg.get('vehicle_information_id') or 1,
                                    "registration_id": reg['registration_id'],
                                    "check_in": current_time,
                                    "check_out": current_time,
                                    "logged_status": "REGISTERED",
                                    "campus": SELECTED_CAMPUS
                                }
                                res = supabase.table('vehicle_log').insert(log_data).execute()
                                vehicle_log_id = res.data[0]['vehicle_log_id'] if res.data else None

                            update_parking_availability('out', vehicle_log_id)
                            print(f"[{side.type}] Exit logged and capacity updated successfully for {data}")
                    except Exception as e:
                        print(f"Error logging exit during countdown: {e}")
                threading.Thread(target=_log_exit, daemon=True).start()
        elif side.state == GateState.PROCESSING:
            draw_text(display, "PROCESSING...", (cx + 20, 80), 0.8, (255, 255, 0), 2)
                
        render_side(display, side, cx)

    # Render Bottom Left (Dashboard)
    render_side_dashboard(display)
    if side_in.state == GateState.SCANNING and side_out.state == GateState.SCANNING:
        draw_btn(display, (130, H - 60, 100, 40), "BACK", (100,100,100))

    # Render Bottom Right (Table)
    cv2.rectangle(display, (W//2, H//2), (W, H), (50,50,50), -1)
    draw_text(display, "LOGS TABLE (Scroll to view)", (W//2 + 20, H//2 + 40), 1.0, (200,200,200), 2)
    y_off = H//2 + 80
    max_visible_logs = 8
    
    # Render scrollbar track
    if len(global_logs) > max_visible_logs:
        cv2.rectangle(display, (W - 15, H//2 + 70), (W - 5, H - 20), (30,30,30), -1)
        scroll_h = max(20, int((max_visible_logs / len(global_logs)) * (H//2 - 90)))
        max_offset = max(1, len(global_logs) - max_visible_logs)
        scroll_y = H//2 + 70 + int((log_scroll_offset / max_offset) * (H//2 - 90 - scroll_h))
        cv2.rectangle(display, (W - 15, scroll_y), (W - 5, scroll_y + scroll_h), (150,150,150), -1)

    visible_logs = global_logs[log_scroll_offset : log_scroll_offset + max_visible_logs]
    for i, log in enumerate(visible_logs):
        draw_text(display, f"{log['time']} | {log['bound']} | {log['name']} | {log['plate']}", (W//2 + 20, y_off + i*35), 0.6)

    cv2.imshow("GateQR Dashboard", display)
    
    key = cv2.waitKey(10) & 0xFF
    if key == 27: # ESC
        break
    elif key != 255: # some key pressed
        char = chr(key) if key < 128 else ""
        
        # Route keystroke to active form field
        for side in [side_in, side_out]:
            if side.state in [GateState.MANUAL_REG, GateState.MANUAL_GUEST_OUT]:
                if key == 8: side.form_data[0] = side.form_data[0][:-1] # backspace
                elif re.match(r'[a-zA-Z0-9\-_ ]', char): side.form_data[0] += char.upper()
            elif side.state == GateState.MANUAL_GUEST_IN:
                idx = side.input_field
                if idx < len(side.form_data):
                    if key == 8: side.form_data[idx] = side.form_data[idx][:-1]
                    elif char.isprintable(): side.form_data[idx] += char.upper()

if cap1 is not None:
    cap1.release()
if has_dual_cam and cap2 is not None: cap2.release()
cv2.destroyAllWindows()