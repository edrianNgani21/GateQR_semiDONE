# Raspberry Pi QR Gate Control Setup Guide

## Overview
This guide will help you set up the automatic QR code scanner with gate control on your Raspberry Pi.

## Key Features
- ✅ Automatic gate opening after valid QR scan
- ✅ 10-second countdown before auto-closing
- ✅ Vehicle details display (plate number, owner info, etc.)
- ✅ No manual let-in/reject buttons needed
- ✅ Real-time status validation

## Hardware Requirements
- Raspberry Pi (3B+, 4, or newer recommended)
- Raspberry Pi Camera Module
- Servo motor (SG90 or similar)
- Jumper wires
- Breadboard (optional)
- Power supply for Pi
- Gate barrier mechanism connected to servo

## Software Requirements
- Raspberry Pi OS (Bullseye or Bookworm)
- Python 3
- Internet connection

## Step 1: Hardware Setup

### Servo Motor Connection
Connect your servo motor to the Raspberry Pi:

| Servo Wire | Raspberry Pi GPIO |
|------------|-------------------|
| Red (VCC)  | 5V pin (pin 2 or 4) |
| Brown/Black (GND) | GND pin (pin 6 or any GND) |
| Orange/White (Signal) | GPIO 18 (pin 12) |

### Camera Setup
1. Connect the camera module to the Raspberry Pi camera port
2. Enable the camera:
   ```bash
   sudo raspi-config
   # Navigate to Interface Options -> Camera -> Enable
   # Reboot the Pi
   ```

## Step 2: Transfer Files to Raspberry Pi

### Option A: Using SCP (Recommended)
From your Windows computer:

```bash
# Copy the Python script
scp raspberry_pi_qr_gate.py pi@YOUR_PI_IP:~/

# Copy requirements file
scp raspberry_pi_requirements.txt pi@YOUR_PI_IP:~/
```

### Option B: Using USB Drive
1. Copy files to a USB drive
2. Plug USB drive into Raspberry Pi
3. Copy files to Pi home directory:
   ```bash
   cp /media/pi/USB_DRIVE/raspberry_pi_qr_gate.py ~/
   cp /media/pi/USB_DRIVE/raspberry_pi_requirements.txt ~/
   ```

### Option C: Using Git (If using version control)
```bash
git clone YOUR_REPOSITORY_URL
cd YOUR_REPOSITORY
```

## Step 3: Install Dependencies on Raspberry Pi

SSH into your Raspberry Pi and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python dependencies
pip3 install -r raspberry_pi_requirements.txt

# Install additional system dependencies
sudo apt install -y python3-opencv libzbar0

# Enable camera interface (if not already done)
sudo raspi-config
```

## Step 4: Configure the Script

Edit the configuration in `raspberry_pi_qr_gate.py`:

```python
# Change these values based on your setup
API_BASE_URL = "http://YOUR_SERVER_IP:5173/api"  # Your server IP address
GATE_API_KEY = "your-actual-gate-api-key"  # From your .env file
SERVO_PIN = 18  # GPIO pin number
GATE_OPEN_TIME = 10  # Seconds to keep gate open
```

### Finding Your Server IP
On your Windows computer:
```bash
ipconfig
```
Look for your IPv4 address (e.g., 192.168.1.XX)

### Getting Your Gate API Key
From your project `.env` file, copy the `GATE_API_KEY` value.

## Step 5: Calibrate Servo Motor

The servo values may need adjustment based on your specific servo:

```python
# In the script, adjust these values:
def open_gate():
    servo.ChangeDutyCycle(7.5)  # Try values between 5-12
    time.sleep(1)

def close_gate():
    servo.ChangeDutyCycle(2.5)  # Try values between 2-5
    time.sleep(1)
```

Test different values to find the correct open/close positions for your gate mechanism.

## Step 6: Test the Setup

```bash
# Make script executable
chmod +x raspberry_pi_qr_gate.py

# Run the script
python3 raspberry_pi_qr_gate.py
```

### Testing Checklist
- [ ] Camera view appears in window
- [ ] QR codes are detected when shown to camera
- [ ] Valid QR codes open the servo motor
- [ ] Gate closes automatically after 10 seconds
- [ ] Vehicle information displays correctly
- [ ] Invalid QR codes don't open the gate

## Step 7: Auto-Start on Boot (Optional)

To make the script start automatically when the Pi boots:

1. Create a systemd service file:
   ```bash
   sudo nano /etc/systemd/system/qr-gate.service
   ```

2. Add this content:
   ```ini
   [Unit]
   Description=QR Gate Control Service
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi
   ExecStart=/usr/bin/python3 /home/pi/raspberry_pi_qr_gate.py
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start the service:
   ```bash
   sudo systemctl enable qr-gate.service
   sudo systemctl start qr-gate.service
   sudo systemctl status qr-gate.service
   ```

## Troubleshooting

### Camera Not Working
```bash
# Check if camera is detected
vcgencmd get_camera

# Test camera
libcamera-hello
```

### Servo Not Moving
- Check GPIO connections
- Verify power supply (servo may need external power)
- Test servo with different duty cycle values
- Check if GPIO 18 is not used by other services

### API Connection Failed
- Verify your server is running
- Check firewall settings
- Ensure Raspberry Pi can reach your server IP
- Test API connection:
  ```bash
  curl http://YOUR_SERVER_IP:5173/api/gate/lookup
  ```

### QR Code Not Detected
- Ensure good lighting
- Check camera focus
- Verify QR code quality and size
- Try different camera resolutions

## Security Considerations

1. **API Key Security**: Keep your GATE_API_KEY secure
2. **Network Security**: Use HTTPS in production
3. **Physical Security**: Secure the Raspberry Pi and camera
4. **Access Control**: Limit network access to the gate system

## Customization Options

### Change Gate Open Time
```python
GATE_OPEN_TIME = 15  # Change to desired seconds
```

### Add Sound Alerts
```python
import pygame
pygame.mixer.init()
pygame.mixer.music.load('alert.mp3')
pygame.mixer.music.play()
```

### Add Display Screen
Connect an LCD display to show vehicle information instead of console output.

## Support

For issues with:
- **Hardware**: Check connections and power supply
- **Software**: Review error messages and logs
- **API**: Verify server connectivity and authentication

## Files Summary

- `raspberry_pi_qr_gate.py` - Main scanner script
- `raspberry_pi_requirements.txt` - Python dependencies
- `RASPBERRY_PI_SETUP.md` - This setup guide