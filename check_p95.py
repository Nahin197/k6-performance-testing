
import json
from collections import defaultdict
from datetime import datetime
from math import ceil

# ==========================================
# Configuration
# ==========================================
INPUT_FILE = "results/endurance-5m.json"

# ==========================================
# Load HTTP response-time samples
# ==========================================
samples = []

with open(INPUT_FILE, "r", encoding="utf-8") as file:
    for line in file:
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue

        if (
            item.get("type") != "Point"
            or item.get("metric") != "http_req_duration"
        ):
            continue

        data = item.get("data", {})

        try:
            timestamp = datetime.fromisoformat(
                data["time"].replace("Z", "+00:00")
            )
            value = float(data["value"])
        except (KeyError, ValueError, TypeError, AttributeError):
            continue

        samples.append({
            "time": timestamp,
            "value": value,
        })

if not samples:
    raise SystemExit(
        "No http_req_duration samples found. "
        "Check the input JSON file."
    )

# ==========================================
# Group samples into one-minute intervals
# ==========================================
start_time = min(sample["time"] for sample in samples)

durations_by_minute = defaultdict(list)

for sample in samples:
    elapsed_seconds = (
        sample["time"] - start_time
    ).total_seconds()

    minute = int(elapsed_seconds // 60) + 1
    durations_by_minute[minute].append(sample["value"])

# ==========================================
# Calculate and report each minute
# ==========================================
for minute, values in sorted(durations_by_minute.items()):
    values.sort()

    count = len(values)
    average = sum(values) / count

    # Nearest-rank percentile calculation
    p95_index = ceil(0.95 * count) - 1
    p95 = values[p95_index]

    maximum = values[-1]
    minimum = values[0]

    above_p95 = sum(value > p95 for value in values)

    print(f"\nMinute {minute}")
    print(f"Sample count: {count}")
    print(f"Average: {average:.4f} ms")
    print(f"P95: {p95:.4f} ms")
    print(f"Minimum: {minimum:.4f} ms")
    print(f"Maximum: {maximum:.4f} ms")
    print(f"Samples above p95: {above_p95}")

    if p95 < average:
        print(
            "INFO: Average exceeds p95. "
            "A small number of slow requests may "
            "be pulling up the average."
        )

    if minimum < 0:
        print("WARNING: Negative response time detected.")

print("\nAnalysis completed successfully.")
