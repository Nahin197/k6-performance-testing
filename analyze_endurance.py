
import json
import math
import csv
from collections import defaultdict
from datetime import datetime

# ==========================================
# Configuration
# ==========================================
INPUT_FILE = "results/endurance-10m.json"
OUTPUT_FILE = "results/10minute-summary.csv"

# ==========================================
# Load k6 JSON time-series data
# ==========================================
samples = []

with open(INPUT_FILE, "r", encoding="utf-8") as file:
    for line in file:
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue

        if item.get("type") != "Point":
            continue

        metric = item.get("metric")
        data = item.get("data", {})

        if metric not in (
            "http_req_duration",
            "http_reqs",
            "http_req_failed",
        ):
            continue

        timestamp = data.get("time")
        value = data.get("value")

        if timestamp is None or value is None:
            continue

        try:
            timestamp = datetime.fromisoformat(
                timestamp.replace("Z", "+00:00")
            )
            value = float(value)
        except (ValueError, TypeError):
            continue

        samples.append({
            "metric": metric,
            "time": timestamp,
            "value": value,
        })

if not samples:
    raise SystemExit(
        "No metric samples found. Check your k6 JSON output file."
    )

# ==========================================
# Group samples into one-minute intervals
# ==========================================
start_time = min(sample["time"] for sample in samples)

minutes = defaultdict(lambda: {
    "durations": [],
    "requests": 0,
    "failures": 0,
})

for sample in samples:
    elapsed_seconds = (
        sample["time"] - start_time
    ).total_seconds()

    minute = int(elapsed_seconds // 60) + 1
    bucket = minutes[minute]

    if sample["metric"] == "http_req_duration":
        bucket["durations"].append(sample["value"])

    elif sample["metric"] == "http_reqs":
        bucket["requests"] += sample["value"]

    elif sample["metric"] == "http_req_failed":
        # Each sample is 1 for a failed request,
        # or 0 for a successful request.
        bucket["failures"] += sample["value"]


# ==========================================
# Calculate nearest-rank percentile
# ==========================================
def percentile(values, percentage):
    if not values:
        return None

    if not 0 < percentage <= 1:
        raise ValueError("Percentage must be > 0 and <= 1.")

    sorted_values = sorted(values)

    index = math.ceil(
        percentage * len(sorted_values)
    ) - 1

    index = max(0, min(index, len(sorted_values) - 1))

    return sorted_values[index]


# ==========================================
# Calculate metrics and export CSV
# ==========================================
with open(
    OUTPUT_FILE,
    "w",
    newline="",
    encoding="utf-8"
) as file:

    writer = csv.writer(file)

    writer.writerow([
        "Minute",
        "Requests",
        "Avg Response (ms)",
        "P95 Response (ms)",
        "Failed Requests",
        "Failure Rate (%)",
    ])

    for minute in sorted(minutes):
        bucket = minutes[minute]

        durations = bucket["durations"]
        requests = int(bucket["requests"])
        failures = int(bucket["failures"])

        # Average response time from individual samples
        avg = (
            sum(durations) / len(durations)
            if durations else None
        )

        # P95 from individual response-time samples
        p95 = percentile(durations, 0.95)

        # Validate p95 against the arithmetic mean
        if avg is not None and p95 is not None:
            if p95 < avg:
                print(
                    f"WARNING: Minute {minute}: "
                    f"p95 ({p95:.2f} ms) is below "
                    f"average ({avg:.2f} ms). "
                    "Inspect the data and calculation."
                )

        # Failed requests are counted as 1 per failed request
        failure_rate = (
            failures / requests * 100
            if requests > 0 else 0
        )

        writer.writerow([
            minute,
            requests,
            round(avg, 2) if avg is not None else "",
            round(p95, 2) if p95 is not None else "",
            failures,
            round(failure_rate, 2),
        ])

# ==========================================
# Finish
# ==========================================
print("Endurance analysis completed.")
print(f"Input file:  {INPUT_FILE}")
print(f"Output file: {OUTPUT_FILE}")
print(f"Minutes analyzed: {len(minutes)}")
