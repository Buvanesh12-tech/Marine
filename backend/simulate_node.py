import time
import random
import requests
import cv2
import numpy as np

BACKEND_URL = "http://localhost:8000/api/upload"

def generate_simulation_image(scenario: str) -> str:
    """
    Generates a mock sea-surface image based on scenario type.
    Saves and returns filepath.
    """
    # Create blue/cyan ocean background image
    img = np.zeros((240, 320, 3), dtype=np.uint8)
    img[:] = [180, 120, 40] # Sea blue-green color in BGR
    
    # Draw simple sea wave patterns
    cv2.line(img, (20, 40), (80, 40), (200, 150, 60), 1)
    cv2.line(img, (140, 120), (220, 120), (200, 150, 60), 1)
    cv2.line(img, (80, 200), (160, 200), (200, 150, 60), 1)

    filename = "capture.jpg"
    
    if scenario == "debris":
        filename = "debris_sample.jpg"
        # Draw a yellow circle representing a floating cup/can
        cv2.circle(img, (160, 120), 15, (0, 220, 220), -1)
        cv2.putText(img, "Debris Specimen", (140, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
        
    elif scenario == "oil":
        # Save as oil_spill.jpg so filename trigger catches it in detector.py
        filename = "oil_spill_sample.jpg"
        # Draw a dark gray patch representing oil sheen
        pts = np.array([[80, 80], [240, 60], [260, 160], [100, 180]], np.int32)
        cv2.fillPoly(img, [pts], (40, 40, 40))
        cv2.putText(img, "Oil Sheen Area", (100, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
        
    else:
        # Clean scenario
        filename = "clean_ocean.jpg"
        cv2.putText(img, "Monitoring...", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
        
    cv2.imwrite(filename, img)
    return filename

def run_simulation():
    print("Starting Marine Sentinel Node Hardware Simulation Loop...")
    print("Press Ctrl+C to terminate.")

    # Starting coordinates
    lat = 13.024397
    lng = 80.017257
    
    scenarios = ["clean", "clean", "debris", "clean", "oil", "clean"]
    step = 0

    while True:
        scenario = scenarios[step % len(scenarios)]
        print(f"\n--- Simulation Step {step + 1} (Scenario: {scenario.upper()}) ---")
        
        # 1. Update coordinates simulating movement
        # Drift slightly northeast
        lat += 0.00012 + random.uniform(-0.00003, 0.00003)
        lng += 0.00015 + random.uniform(-0.00003, 0.00003)
        speed = round(random.uniform(4.5, 7.8), 2)
        
        # 2. Simulate sensors
        # Turbidity levels (clean 100-300, debris/oil spikes it)
        ph = round(random.uniform(7.1, 7.5), 2)
        temp = round(random.uniform(24.2, 25.8), 1)

        if scenario == "clean":
            turb = random.randint(120, 240)
            ir = [0, 0, 0]
            status = "SAFE"
        elif scenario == "debris":
            turb = random.randint(300, 450)
            ph = round(random.uniform(6.5, 6.9), 2)
            ir = [random.choice([0, 1]), 0, 0]
            status = "WARNING"
        else: # oil
            turb = random.randint(650, 800) # Critical levels
            ph = round(random.uniform(5.5, 6.2), 2)
            ir = [0, random.choice([0, 1]), 0]
            status = "CRITICAL"

        # Gyro (simulated tilt/pitch)
        gyro = {
            "ax": round(random.uniform(-0.5, 0.5), 3),
            "ay": round(random.uniform(-0.4, 0.4), 3),
            "az": round(9.8 + random.uniform(-0.2, 0.2), 3),
            "gx": round(random.uniform(-0.02, 0.02), 3),
            "gy": round(random.uniform(-0.03, 0.03), 3),
            "gz": round(random.uniform(-0.01, 0.01), 3),
        }

        # Format GPS
        gps = {
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "spd": speed
        }

        telemetry_payload = {
            "gps": gps,
            "turb": turb,
            "ph": ph,
            "temp": temp,
            "gyro": gyro,
            "ir": ir,
            "status": status
        }

        # 3. Create simulated image file
        image_file = generate_simulation_image(scenario)
        
        # 4. Transmit multipart payload
        try:
            with open(image_file, "rb") as f:
                files = {"image": (image_file, f, "image/jpeg")}
                data = {"telemetry": json_str := str(telemetry_payload).replace("'", '"')}
                
                print(f"Uploading image: {image_file}")
                print(f"Ingesting Telemetry: {json_str}")
                
                response = requests.post(BACKEND_URL, files=files, data=data, timeout=5)
                
                if response.status_code == 200:
                    resp_json = response.json()
                    print(f"Server Ingestion Success!")
                    print(f"Direct Response command returned: {resp_json.get('command')}")
                else:
                    print(f"Server Ingestion Error ({response.status_code}): {response.text}")
        except Exception as e:
            print(f"Network Connection Failed: {e}")

        # Sleep for 5 seconds matching the update intervals
        time.sleep(5)
        step += 1

if __name__ == "__main__":
    run_simulation()
