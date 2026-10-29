# k6 Performance Testing Project

A hands-on performance testing suite built with **[k6](https://k6.io/)** that covers six test types — load, stress, spike, endurance, volume, and scenario-based comparison — against a custom-built **Express.js REST API**. Python analysis scripts are included to process raw k6 output and generate structured CSV reports.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [The Target API](#the-target-api)
  - [Endpoints](#endpoints)
  - [Starting the Server](#starting-the-server)
- [Test Types](#test-types)
- [Running the Tests](#running-the-tests)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Run Commands](#run-commands)
- [Test Results](#test-results)
  - [GET Endpoint Results Summary](#get-endpoint-results-summary)
  - [POST Endpoint Results Summary](#post-endpoint-results-summary)
  - [Endurance 10-Minute Breakdown](#endurance-10-minute-breakdown-csv)
- [Python Analysis Scripts](#python-analysis-scripts)
- [Understanding the Threshold Results](#understanding-the-threshold-results)

---

## Project Structure

```
k6-performance-testing/
│
├── server.js                        # Main Express API (standard server)
├── serverForVolumeTesting.js        # Express API variant for volume testing
├── package.json
│
├── tests/
│   ├── get-test.js                  # GET baseline: 1 VU, 5 iterations
│   ├── load-test.js                 # Load: staged ramp-up to 10 VUs
│   ├── stress-test.js               # Stress: staged ramp-up to 50 VUs
│   ├── spike-test.js                # Spike: sudden burst to 50 VUs
│   ├── endurance-test.js            # Endurance: 10 VUs held for 10 minutes
│   ├── volume-test.js               # Volume: large data payload (configurable limit)
│   ├── post-test.js                 # POST baseline: 1 VU, 5 iterations
│   ├── post-performance.js          # POST load: configurable VUs/duration via env vars
│   ├── post-spike-stress-endurance.js  # Multi-profile POST test (load/stress/spike/endurance)
│   ├── post-volume-testing.js       # Volume POST: configurable payload size via ITEM_COUNT
│   ├── stress-stages.js             # Scenario comparison: 3 parallel workloads with custom metrics
│   └── stress-comparison.js        # Simple stress baseline with configurable VUs
│
├── results/
│   ├── gets-summary.json            # GET baseline result
│   ├── load-summary.json            # Load test result
│   ├── stress-summary.json          # Stress test result (full staged run)
│   ├── spike-summary.json           # Spike test result
│   ├── endurance-summary.json       # Endurance test result
│   ├── stress-10.json               # Stress comparison: 10 VUs
│   ├── stress-20.json               # Stress comparison: 20 VUs
│   ├── stress-50.json               # Stress comparison: 50 VUs
│   ├── post-summary.json            # POST baseline result
│   ├── post-load.json               # POST load test result
│   ├── post-stress.json             # POST stress test result
│   ├── post-spike.json              # POST spike test result
│   ├── post-endurance.json          # POST endurance test result
│   ├── post-10.json                 # POST performance: 10 VUs
│   ├── post-20.json                 # POST performance: 20 VUs
│   ├── post-50.json                 # POST performance: 50 VUs
│   ├── post-volume-10.json          # POST volume: 10 items per order
│   ├── post-volume-100.json         # POST volume: 100 items per order
│   ├── post-volume-500.json         # POST volume: 500 items per order
│   ├── endurance-5m.json            # Raw k6 NDJSON output (5-minute run)
│   ├── endurance-10m.json           # Raw k6 NDJSON output (10-minute run)
│   ├── minute-summary.csv           # Minute-by-minute analysis of 5-minute endurance run
│   └── 10minute-summary.csv         # Minute-by-minute analysis of 10-minute endurance run
│
├── check_p95.py                     # Parses endurance-5m.json → prints per-minute p95 stats
└── analyze_endurance.py             # Parses endurance-10m.json → exports 10minute-summary.csv
```

---

## Tech Stack

| Tool | Purpose |
|---|---|
| [k6](https://k6.io/) | Performance test execution engine |
| [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) | Target REST API |
| [Python 3](https://www.python.org/) | Post-run analysis and CSV reporting |
| [nodemon](https://nodemon.io/) | Auto-restart server during development |

---

## The Target API

A lightweight in-memory REST API (`server.js`) is the system under test. It simulates a real e-commerce backend with product listing and order creation endpoints.

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check — returns `{ status: "ok" }` |
| `GET` | `/api/products?page=1&limit=20` | Returns paginated product list (1,000 products total) |
| `GET` | `/api/products/:id` | Returns a single product by ID |
| `POST` | `/api/orders` | Creates an order with validated items |

**POST `/api/orders` Request Body:**
```json
{
  "customerId": 1001,
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 2, "quantity": 1 }
  ]
}
```

**Validation rules:**
- `customerId` must be a positive integer
- `items` must be a non-empty array
- Each item must have a valid `productId` (must exist in the product list) and a positive `quantity`

**Response codes:** `200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`

### Starting the Server

**Standard server** (for all tests except volume testing):
```bash
node server.js
```

**Volume testing server** (supports `PRODUCT_COUNT` env var):
```bash
node serverForVolumeTesting.js
# Or with a custom product count:
PRODUCT_COUNT=5000 node serverForVolumeTesting.js
```

**With auto-restart (nodemon):**
```bash
npx nodemon server.js
```

The server starts on `http://127.0.0.1:3000` by default. Override the port with `PORT=4000 node server.js`.

---

## Test Types

| Test | File | VUs | Duration | Purpose |
|---|---|---|---|---|
| **GET Baseline** | `get-test.js` | 1 | 5 iterations | Verifies correct response body and status |
| **Load** | `load-test.js` | ramp 5→10 | ~2m 20s | Simulates expected normal + peak load |
| **Stress** | `stress-test.js` | ramp 10→20→50 | ~3m | Finds the breaking point of the system |
| **Spike** | `spike-test.js` | 5 → burst 50 → 5 | ~1m 35s | Tests sudden traffic surge recovery |
| **Endurance** | `endurance-test.js` | 10 | 10m 30s | Detects memory leaks and degradation over time |
| **Volume** | `volume-test.js` | 5 | 30s | Tests large data retrieval (configurable limit) |
| **POST Baseline** | `post-test.js` | 1 | 5 iterations | Verifies order creation correctness |
| **POST Load** | `post-performance.js` | configurable | configurable | Load tests the order creation endpoint |
| **POST Multi-profile** | `post-spike-stress-endurance.js` | varies by profile | varies | Single file: runs load/stress/spike/endurance via `TEST_TYPE` env var |
| **POST Volume** | `post-volume-testing.js` | 5 | 30s | Tests order creation with large item arrays |
| **Stress Scenarios** | `stress-stages.js` | 10 / 20 / 50 | 3×60s | Runs three workloads in parallel with separate custom metrics |
| **Stress Comparison** | `stress-comparison.js` | configurable | 60s | Simple fixed-load baseline for quick comparisons |

---

## Running the Tests

### Prerequisites

1. Install [k6](https://k6.io/docs/get-started/installation/)
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Start the server (in a separate terminal):
   ```bash
   node server.js
   ```

### Environment Variables

| Variable | Default | Used In | Description |
|---|---|---|---|
| `BASE_URL` | `http://127.0.0.1:3000` | All tests | Target server base URL |
| `VUS` | `10` | `post-performance.js`, `stress-comparison.js` | Number of virtual users |
| `DURATION` | `30s` | `post-performance.js` | Test duration string |
| `TEST_TYPE` | `load` | `post-spike-stress-endurance.js`, `post-volume-testing.js` | Profile selector: `load`, `stress`, `spike`, or `endurance` |
| `ITEM_COUNT` | `10` | `post-volume-testing.js` | Number of items per order payload |
| `LIMIT` | `1000` | `volume-test.js` | Number of products to fetch per request |
| `PRODUCT_COUNT` | `1000` | `serverForVolumeTesting.js` | Products in the server dataset |
| `PORT` | `3000` | `server.js`, `serverForVolumeTesting.js` | Server listen port |

### Run Commands

Save results to a JSON file with `--out json=results/<filename>.json`.

**GET tests:**
```bash
# Baseline GET test (1 VU, 5 iterations)
k6 run tests/get-test.js

# Load test (ramp 5→10 VUs)
k6 run tests/load-test.js

# Stress test (ramp 10→20→50 VUs)
k6 run tests/stress-test.js

# Spike test (5 VUs → burst 50 → back to 5)
k6 run tests/spike-test.js

# Endurance test (10 VUs for 10 minutes)
k6 run tests/endurance-test.js

# Volume test (default 1000 records)
k6 run tests/volume-test.js

# Volume test with custom limit
k6 run -e LIMIT=500 tests/volume-test.js
```

**POST tests:**
```bash
# POST baseline (1 VU, 5 iterations)
k6 run tests/post-test.js

# POST load test (10 VUs, 30s — configurable)
k6 run tests/post-performance.js
k6 run -e VUS=20 -e DURATION=60s tests/post-performance.js

# POST multi-profile (change TEST_TYPE to switch profiles)
k6 run -e TEST_TYPE=load     tests/post-spike-stress-endurance.js
k6 run -e TEST_TYPE=stress   tests/post-spike-stress-endurance.js
k6 run -e TEST_TYPE=spike    tests/post-spike-stress-endurance.js
k6 run -e TEST_TYPE=endurance tests/post-spike-stress-endurance.js

# POST volume testing (uses serverForVolumeTesting.js)
node serverForVolumeTesting.js  # start this server first
k6 run -e ITEM_COUNT=10  tests/post-volume-testing.js
k6 run -e ITEM_COUNT=100 tests/post-volume-testing.js
k6 run -e ITEM_COUNT=500 tests/post-volume-testing.js
```

**Scenario-based tests:**
```bash
# Parallel 3-stage scenario comparison (10 / 20 / 50 VUs)
k6 run tests/stress-stages.js

# Simple stress comparison (configurable VUs)
k6 run tests/stress-comparison.js
k6 run -e VUS=50 tests/stress-comparison.js
```

**Save raw output for analysis:**
```bash
k6 run --out json=results/endurance-10m.json tests/endurance-test.js
k6 run --out json=results/load-summary.json  tests/load-test.js
```

---

## Test Results

All results are stored in the `results/` folder. Below is a summary extracted from the actual JSON output files.

### GET Endpoint Results Summary

| Test | VUs | Requests | Avg (ms) | p(95) (ms) | Error Rate |
|---|---|---|---|---|---|
| Baseline (`get-test.js`) | 1 | 5 | 3.11 | 5.91 | 0% |
| Load (`load-test.js`) | up to 10 | 900 | 1.15 | 2.01 | 0% ✅ |
| Stress (`stress-test.js`) | up to 50 | 1,167,998 | 3.38 | 8.23 | 0% ✅ |
| Spike (`spike-test.js`) | up to 50 | 3,993 | 0.99 | 1.77 | 0% ✅ |
| Endurance (`endurance-test.js`) | 10 | 3,315 | 1.02 | 1.85 | 0% ✅ |
| Stress Comparison: 10 VUs | 10 | 1,200 | 1.18 | 2.30 | 0% |
| Stress Comparison: 20 VUs | 20 | 2,400 | 1.33 | 2.97 | 0% |
| Stress Comparison: 50 VUs | 50 | 6,000 | 1.51 | 3.83 | 0% |

> The server handled all GET test loads without any errors. Response times stayed well under 10ms p(95) even under 50 VUs — well within the 500ms threshold.

### POST Endpoint Results Summary

| Test | VUs | Requests | Avg (ms) | p(95) (ms) | All Checks |
|---|---|---|---|---|---|
| Baseline (`post-test.js`) | 1 | 5 | 36.87 | 145.21 | ✅ |
| Load (`post-load.json`) | 10 | 1,200 | 3.30 | 3.81 | ✅ |
| Stress (`post-stress.json`) | up to 50 | 7,971 | 1.27 | 2.37 | ✅ |
| Spike (`post-spike.json`) | up to 50 | 3,990 | 1.22 | 2.31 | ✅ |
| Endurance (`post-endurance.json`) | 10 | 6,607 | 1.29 | 2.09 | ✅ |
| POST: 10 VUs (`post-10.json`) | 10 | 600 | 5.31 | 4.30 | ✅ |
| POST: 20 VUs (`post-20.json`) | 20 | 1,200 | 1.83 | 4.67 | ✅ |
| POST: 50 VUs (`post-50.json`) | 50 | 3,000 | 1.99 | 6.12 | ✅ |

**Volume POST Results (payload size impact):**

| Test | Item Count per Order | VUs | Requests | Avg (ms) | p(95) (ms) |
|---|---|---|---|---|---|
| `post-volume-10.json` | 10 | 5 | 300 | 1.49 | 2.77 |
| `post-volume-100.json` | 100 | 5 | 300 | 1.31 | 2.50 |
| `post-volume-500.json` | 500 | 5 | 300 | 1.49 | 2.66 |

> Increasing item count from 10 to 500 per order had minimal impact on response time, confirming the in-memory API handles large payloads efficiently.

> **Note on threshold flags:** The k6 summary JSON marks thresholds as `false` when they were **met** (the metric did NOT exceed the limit), and `true` when **violated**. All checks passed with 0% error rate across every run.

### Endurance 10-Minute Breakdown (CSV)

From `results/10minute-summary.csv` — generated by `analyze_endurance.py`:

| Minute | Requests | Avg Response (ms) | P95 Response (ms) | Failed | Failure Rate |
|---|---|---|---|---|---|
| 1 | 453 | 1.28 | 2.10 | 0 | 0% |
| 2 | 600 | 1.27 | 1.88 | 0 | 0% |
| 3 | 600 | 1.24 | 1.79 | 0 | 0% |
| 4 | 597 | 1.29 | 2.14 | 0 | 0% |
| 5 | 600 | 1.10 | 2.09 | 0 | 0% |
| 6 | 597 | 1.13 | 2.16 | 0 | 0% |
| 7 | 600 | 1.09 | 1.92 | 0 | 0% |
| 8 | 600 | 1.10 | 1.96 | 0 | 0% |
| 9 | 600 | 1.07 | 1.89 | 0 | 0% |
| 10 | 596 | 1.05 | 1.93 | 0 | 0% |

> p(95) stayed stable between 1.79ms and 2.16ms across all 10 minutes with zero failures — no memory leak or performance degradation detected.

---

## Python Analysis Scripts

Two Python scripts post-process raw k6 NDJSON output (generated with `--out json`). They use only Python standard library modules — no third-party packages required.

### `check_p95.py`

Reads `results/endurance-5m.json` and prints per-minute statistics to the console.

```bash
python check_p95.py
```

**Output per minute:**
- Sample count
- Average response time
- p(95) response time (nearest-rank method)
- Minimum and maximum
- Count of samples above p(95)
- Anomaly warnings if average exceeds p(95) or if negative response times are detected

### `analyze_endurance.py`

Reads `results/endurance-10m.json` and exports a structured CSV to `results/10minute-summary.csv`.

```bash
python analyze_endurance.py
```

**CSV columns:** `Minute`, `Requests`, `Avg Response (ms)`, `P95 Response (ms)`, `Failed Requests`, `Failure Rate (%)`

Both scripts calculate **p(95) using the nearest-rank method** — the same approach k6 uses internally — so the results are directly comparable to k6's own output.

---

## Understanding the Threshold Results

Thresholds are defined in each test's `options` object and are evaluated by k6 at the end of the run.

| Threshold | Meaning |
|---|---|
| `http_req_failed: ['rate<0.01']` | Less than 1% of requests must fail |
| `http_req_failed: ['rate<0.05']` | Less than 5% of requests must fail |
| `http_req_duration: ['p(95)<500']` | 95th percentile response time must be under 500ms |

In the saved JSON result files, the threshold value `false` means the condition **was satisfied** (the metric stayed within the allowed range). A value of `true` would mean the threshold was **breached**.

All tests in this project passed their thresholds — the API consistently responded with p(95) well under 10ms and 0% error rate across all test scenarios.

