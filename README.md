# API Performance Testing Suite with k6

A complete performance testing project built from scratch to demonstrate real-world SQA engineering skills. I designed and implemented a custom REST API as the system under test, then tested it across **six performance test types** using **k6**, and analyzed the raw results using **custom Python scripts**.

> **Why I built this:** Most QA portfolios only show functional test scripts. I wanted to show I understand how systems behave under pressure — load, stress, spikes, and sustained traffic — and that I can measure and interpret the results, not just run a tool.

---

## What This Project Demonstrates

| Skill | How It's Shown |
|---|---|
| Performance test design | 6 distinct test types with different goals and VU strategies |
| k6 proficiency | Stages, thresholds, custom metrics (Trend/Rate/Counter), named scenarios, env vars |
| API knowledge | Built the target Express.js API myself with real validation and HTTP semantics |
| Result analysis | Wrote Python scripts from scratch to parse raw k6 NDJSON and compute p(95) per minute |
| Test thinking | Chose meaningful thresholds, identified what each test type is trying to find |
| Code quality | Parameterized tests via environment variables, reusable multi-profile test file |

---

## Tech Stack

| Tool | Role |
|---|---|
| [k6](https://k6.io/) | Performance test runner |
| [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) | Custom-built target REST API |
| [Python 3](https://www.python.org/) | Post-run result analysis (standard library only) |

---

## The System Under Test

Instead of testing a third-party service, I built my own REST API so I fully understand every layer of the system.

`server.js` is a lightweight in-memory Express.js API that simulates an e-commerce backend:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/products?page=1&limit=20` | Paginated product list (1,000 products) |
| `GET` | `/api/products/:id` | Single product by ID |
| `POST` | `/api/orders` | Create an order with item validation |

The API enforces strict input validation — invalid `customerId`, missing items, non-existent `productId` all return `400`. This made it realistic to test both happy-path performance and error threshold behavior.

A second server (`serverForVolumeTesting.js`) adds a configurable `PRODUCT_COUNT` environment variable — used specifically for volume tests where dataset size matters.

**Start the server:**
```bash
node server.js
# or for volume tests:
node serverForVolumeTesting.js
```

---

## Test Strategy

I covered the six core performance test types used in industry. Each has a specific purpose — they're not interchangeable.

### 1. Load Test — `tests/load-test.js`
**Goal:** Does the system handle normal expected traffic?

```
Ramp-up →  5 VUs for 20s
Hold    →  5 VUs for 40s
Ramp-up → 10 VUs for 20s
Hold    → 10 VUs for 40s
Ramp-down → 0 VUs for 20s
```
**Thresholds:** Error rate < 1% · p(95) < 500ms

---

### 2. Stress Test — `tests/stress-test.js`
**Goal:** Where does the system start to degrade?

```
Ramp 10 VUs → 20 VUs → 50 VUs in steps
Each stage: 20s ramp + 30s hold
```
**Thresholds:** Error rate < 5%

I ran this at 10, 20, and 50 VUs separately (saved as `stress-10.json`, `stress-20.json`, `stress-50.json`) to compare how response time scales with concurrency.

---

### 3. Spike Test — `tests/spike-test.js`
**Goal:** Can the system absorb a sudden traffic burst and recover?

```
Warm-up:  5 VUs for 20s
Spike:   50 VUs in 5s  ← instant jump
Hold:    50 VUs for 30s
Drop:     5 VUs in 5s
Recovery: 5 VUs for 30s
```

---

### 4. Endurance Test — `tests/endurance-test.js`
**Goal:** Does performance degrade over time? (Memory leaks, resource exhaustion)

```
Ramp:  10 VUs over 30s
Hold:  10 VUs for 10 minutes
Ramp-down: 0 VUs over 30s
```
**Thresholds:** Error rate < 1% · p(95) < 500ms

I ran the raw output with `--out json` and then analyzed it minute-by-minute with Python to check for drift.

---

### 5. Volume Test — `tests/volume-test.js`
**Goal:** How does the system handle large data payloads?

Tests `GET /api/products` with a configurable `LIMIT` (up to 1,000 records per page). Also tested `POST /api/orders` with item arrays of 10, 100, and 500 items per request.

---

### 6. Scenario Comparison — `tests/stress-stages.js`
**Goal:** Run three concurrency levels in parallel and compare their metrics side-by-side.

Uses k6's **named scenarios** and **custom metrics** to isolate each workload:

```js
// Each stage runs in its own scenario with its own Trend, Rate, Counter
const duration10 = new Trend('response_time_10_vus', true);
const duration20 = new Trend('response_time_20_vus', true);
const duration50 = new Trend('response_time_50_vus', true);

scenarios: {
  stage_10_vus: { executor: 'constant-vus', vus: 10, duration: '60s', startTime: '0s' },
  stage_20_vus: { executor: 'constant-vus', vus: 20, duration: '60s', startTime: '65s' },
  stage_50_vus: { executor: 'constant-vus', vus: 50, duration: '60s', startTime: '130s' },
}
```

This produces **separate** p95/error metrics per workload — not averaged together.

---

## Reusable Multi-Profile Test — `tests/post-spike-stress-endurance.js`

Instead of writing four separate POST test files, I built one parameterized file that switches behavior via `TEST_TYPE`:

```bash
k6 run -e TEST_TYPE=load      tests/post-spike-stress-endurance.js
k6 run -e TEST_TYPE=stress    tests/post-spike-stress-endurance.js
k6 run -e TEST_TYPE=spike     tests/post-spike-stress-endurance.js
k6 run -e TEST_TYPE=endurance tests/post-spike-stress-endurance.js
```

The script throws an error for unknown test types — intentionally designed to fail fast rather than silently run the wrong config.

---

## Running the Tests

### Prerequisites

1. Install [k6](https://k6.io/docs/get-started/installation/)
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Start the server in a separate terminal:
   ```bash
   node server.js
   ```

### All Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `http://127.0.0.1:3000` | Target server URL — change for remote targets |
| `VUS` | `10` | Virtual users (used in configurable tests) |
| `DURATION` | `30s` | Test duration string |
| `TEST_TYPE` | `load` | Profile: `load`, `stress`, `spike`, or `endurance` |
| `ITEM_COUNT` | `10` | Items per POST order payload (volume testing) |
| `LIMIT` | `1000` | Records per GET request (volume testing) |
| `PRODUCT_COUNT` | `1000` | Dataset size in `serverForVolumeTesting.js` |
| `PORT` | `3000` | Server port |

### Commands

```bash
# --- GET Tests ---
k6 run tests/get-test.js                             # Baseline (1 VU, 5 iterations)
k6 run tests/load-test.js                            # Load (ramp 5→10 VUs)
k6 run tests/stress-test.js                          # Stress (ramp 10→20→50 VUs)
k6 run tests/spike-test.js                           # Spike (5 → 50 → 5 VUs)
k6 run tests/endurance-test.js                       # Endurance (10 VUs × 10 min)
k6 run -e LIMIT=500 tests/volume-test.js             # Volume GET (500 records)

# --- POST Tests ---
k6 run tests/post-test.js                            # Baseline (1 VU, 5 iterations)
k6 run -e VUS=20 -e DURATION=60s tests/post-performance.js   # Configurable load
k6 run -e TEST_TYPE=stress tests/post-spike-stress-endurance.js  # Multi-profile

# --- Volume POST (start serverForVolumeTesting.js first) ---
k6 run -e ITEM_COUNT=100 tests/post-volume-testing.js

# --- Scenario Comparison ---
k6 run tests/stress-stages.js

# --- Save raw output for Python analysis ---
k6 run --out json=results/endurance-10m.json tests/endurance-test.js
```

---

## Real Test Results

All results in `results/` come from actual test runs — nothing fabricated. Every number below is extracted directly from the JSON files in the `results/` folder.

> **Metrics explained:**
> - **Throughput** — requests per second the server successfully handled
> - **Avg** — arithmetic mean response time (sensitive to outliers)
> - **p(90) / p(95)** — 90th / 95th percentile: the time within which 90% / 95% of requests completed
> - **Max** — single slowest request in the entire run (worst case)
> - **Error Rate** — percentage of HTTP requests that returned a non-2xx response

---

### GET Endpoint Results

#### Load, Stress, Spike, Endurance

| Test | VUs | Total Requests | Throughput | Avg | p(90) | p(95) | Max | Error Rate |
|---|---|---|---|---|---|---|---|---|
| Baseline | 1 | 5 | 1.00 req/s | 3.11 ms | 5.20 ms | 5.91 ms | 6.62 ms | 0% |
| **Load** | up to 10 | 900 | 6.41 req/s | 1.15 ms | 1.70 ms | 2.01 ms | 24.10 ms | 0% ✅ |
| **Stress** | up to 50 | 1,167,998 | 6,870 req/s | 3.38 ms | 7.07 ms | 8.23 ms | 54.21 ms | 0% ✅ |
| **Spike** | up to 50 | 3,993 | 41.87 req/s | 0.99 ms | 1.52 ms | 1.77 ms | 30.58 ms | 0% ✅ |
| **Endurance** | 10 | 3,315 | 9.19 req/s | 1.02 ms | 1.59 ms | 1.85 ms | 18.19 ms | 0% ✅ |

> **Why the stress test has 1.16 million requests:** The stress test has no `sleep()` call — each VU fires requests as fast as possible. With 50 VUs running without delay, throughput hits ~6,870 req/s. This is intentional: the goal of stress is to find where the system breaks, so artificial thinking time is removed.

> **Spike test observation:** Despite a sudden 10× jump (5 → 50 VUs in 5 seconds), p(95) actually *improved* (2.01ms on load → 1.77ms on spike). This is because the spike test uses `sleep(0.5)` vs the load test's `sleep(1)` — VUs hit the server at slightly higher frequency but the server was not overwhelmed.

> **Max response time:** The worst individual request during the stress test took 54.21ms — still 9× under the 500ms threshold. This shows the server has strong outlier resistance even at extreme load.

---

#### Stress Comparison — Concurrency Scaling (stress-stages.js)

These three runs used a fixed 60s constant-VU scenario each, with separate custom metrics tracked per workload.

| Concurrency | Total Requests | Throughput | Avg | p(90) | p(95) | Max | Error Rate |
|---|---|---|---|---|---|---|---|
| **10 VUs** | 1,200 | 19.93 req/s | 1.18 ms | 1.94 ms | 2.30 ms | 4.19 ms | 0% |
| **20 VUs** | 2,400 | 39.85 req/s | 1.33 ms | 2.38 ms | 2.97 ms | 9.12 ms | 0% |
| **50 VUs** | 6,000 | 99.54 req/s | 1.51 ms | 3.11 ms | 3.83 ms | 11.63 ms | 0% |

> **Scaling analysis:** Throughput scaled nearly linearly — 5× the users produced 4.99× the throughput (19.93 → 99.54 req/s). Meanwhile, p(95) only grew 1.67× (2.30 → 3.83ms). This is a healthy ratio: the server is parallelizing work without significant queueing. If the server were struggling, you'd see throughput plateau while latency spiked.

---

### POST Endpoint Results

#### Load, Stress, Spike, Endurance

| Test | VUs | Total Requests | Throughput | Avg | p(90) | p(95) | Max | All Checks |
|---|---|---|---|---|---|---|---|---|
| Baseline | 1 | 5 | 26.79 req/s | 36.87 ms | 109.29 ms | 145.21 ms | 181.12 ms | ✅ |
| **Load** | 10 | 1,200 | 19.84 req/s | 3.30 ms | 2.89 ms | 3.81 ms | 217.08 ms | ✅ |
| **Stress** | up to 50 | 7,971 | 46.83 req/s | 1.27 ms | 2.03 ms | 2.37 ms | 31.86 ms | ✅ |
| **Spike** | up to 50 | 3,990 | 41.85 req/s | 1.22 ms | 1.98 ms | 2.31 ms | 29.31 ms | ✅ |
| **Endurance** | 10 | 6,607 | 18.35 req/s | 1.29 ms | 1.80 ms | 2.09 ms | 30.72 ms | ✅ |

> **POST Baseline anomaly — why avg is 36.87ms with max 181ms:** The baseline runs only 5 iterations with 1 VU. The very first request pays the TCP connection establishment cost (~1ms), and k6's iteration warmup can inflate early timings. By the 2nd iteration the server is responding in ~0.64ms. The high p(95) of 145ms comes from 1 outlier in just 5 samples — statistically unreliable at such a small sample size. Multi-VU runs with 1,000+ samples are the meaningful data.

> **Load test max of 217ms:** One request during the 10-VU load test spiked to 217ms — likely the first request in a new TCP connection. The p(95) of 3.81ms confirms this was an isolated outlier, not a systemic issue.

---

#### POST Performance — Concurrency Scaling (post-performance.js)

| Concurrency | Total Requests | Throughput | Avg | p(90) | p(95) | Max | All Checks |
|---|---|---|---|---|---|---|---|
| **10 VUs** | 600 | 19.75 req/s | 5.31 ms | 3.68 ms | 4.30 ms | 209.83 ms | ✅ |
| **20 VUs** | 1,200 | 39.81 req/s | 1.83 ms | 3.41 ms | 4.67 ms | 11.67 ms | ✅ |
| **50 VUs** | 3,000 | 99.48 req/s | 1.99 ms | 3.80 ms | 6.12 ms | 17.95 ms | ✅ |

> **Throughput scales perfectly:** 10→20→50 VUs produced 19.75→39.81→99.48 req/s — almost exact linear scaling. The server is not CPU-bound or connection-limited at these concurrency levels.

---

#### Volume POST — Payload Size Impact (post-volume-testing.js)

Tests how increasing the items array per order (10 → 100 → 500 items) affects performance.

| Items per Order | Payload Size (approx.) | Total Requests | Throughput | Avg | p(90) | p(95) | Max |
|---|---|---|---|---|---|---|---|
| **10 items** | ~220 bytes | 300 | 9.96 req/s | 1.49 ms | 2.28 ms | 2.77 ms | 14.07 ms |
| **100 items** | ~2.2 KB | 300 | 9.96 req/s | 1.31 ms | 2.11 ms | 2.50 ms | 4.56 ms |
| **500 items** | ~11 KB | 300 | 9.95 req/s | 1.49 ms | 2.28 ms | 2.66 ms | 4.17 ms |

> **Key finding:** A 50× increase in payload size (10 → 500 items) produced zero meaningful change in throughput (9.96 → 9.95 req/s) or latency. The server's in-memory validation loop iterates over each item, but at these sizes the loop completes faster than the network overhead. This would be a different story if the server were hitting a database for each item lookup.

---

### Endurance — Minute-by-Minute Stability

*Generated by [`analyze_endurance.py`](analyze_endurance.py) parsing raw k6 NDJSON output from `results/endurance-10m.json`.*

| Minute | Requests | Throughput | Avg (ms) | p(95) (ms) | Failures | Failure Rate |
|---|---|---|---|---|---|---|
| 1 | 453 | ~7.6 req/s | 1.28 | 2.10 | 0 | 0% |
| 2 | 600 | 10.0 req/s | 1.27 | 1.88 | 0 | 0% |
| 3 | 600 | 10.0 req/s | 1.24 | 1.79 | 0 | 0% |
| 4 | 597 | 9.95 req/s | 1.29 | 2.14 | 0 | 0% |
| 5 | 600 | 10.0 req/s | 1.10 | 2.09 | 0 | 0% |
| 6 | 597 | 9.95 req/s | 1.13 | 2.16 | 0 | 0% |
| 7 | 600 | 10.0 req/s | 1.09 | 1.92 | 0 | 0% |
| 8 | 600 | 10.0 req/s | 1.10 | 1.96 | 0 | 0% |
| 9 | 600 | 10.0 req/s | 1.07 | 1.89 | 0 | 0% |
| 10 | 596 | 9.93 req/s | 1.05 | 1.93 | 0 | 0% |

> **Stability verdict — PASS:** p(95) remained stable between 1.79ms (min) and 2.16ms (max) across 10 minutes — a variance of only 0.37ms. Average response time trended downward (1.28ms → 1.05ms), indicating the system warmed up and stabilized rather than degrading. Zero failures in 5,708 total requests confirm no memory leak or resource exhaustion under sustained load.

---

## Python Analysis Scripts

k6's built-in summary averages everything across the entire run. I wanted to see **how performance changed minute by minute** — so I wrote my own analysis scripts.

Both scripts use only the **Python standard library** (no pip installs needed) and implement the **nearest-rank percentile method** — the same calculation k6 uses internally.

### `check_p95.py` — Per-Minute Console Report

Reads `results/endurance-5m.json` (raw NDJSON) and prints a detailed breakdown per minute:

```bash
python check_p95.py
```

Output includes: sample count, average, p(95), min, max, samples above p(95), and anomaly warnings (e.g. if average exceeds p(95), which signals extreme outliers skewing the mean).

### `analyze_endurance.py` — CSV Export

Reads `results/endurance-10m.json` and exports `results/10minute-summary.csv`:

```bash
python analyze_endurance.py
```

CSV columns: `Minute`, `Requests`, `Avg Response (ms)`, `P95 Response (ms)`, `Failed Requests`, `Failure Rate (%)`

---

## Key Concepts Used

**Virtual Users (VUs):** Each VU in k6 runs the test function in a continuous loop. 10 VUs ≈ 10 concurrent users hammering the API simultaneously.

**p(95) — 95th Percentile Response Time:** The response time that 95% of requests completed within. More useful than the average because it's not distorted by a few slow outliers.

**Thresholds:** Pass/fail gates on metrics. If `p(95) < 500ms` is defined and p(95) reaches 600ms, the test exits with a non-zero status code — useful for CI/CD pipeline integration.

**Stages:** Allow gradual ramp-up and ramp-down of VUs within a single test run — simulating real user arrival patterns rather than an instant jump.

**Custom Metrics (`Trend`, `Rate`, `Counter`):** Used in `stress-stages.js` to track separate metrics per scenario. Without custom metrics, all scenarios would be merged into one aggregate.

---

## Project Structure

```
k6-performance-testing/
│
├── server.js                         # Target API (standard)
├── serverForVolumeTesting.js         # Target API (volume variant)
│
├── tests/
│   ├── get-test.js                   # GET baseline
│   ├── load-test.js                  # Load test
│   ├── stress-test.js                # Stress test
│   ├── spike-test.js                 # Spike test
│   ├── endurance-test.js             # Endurance / soak test
│   ├── volume-test.js                # Volume GET test
│   ├── post-test.js                  # POST baseline
│   ├── post-performance.js           # POST load (configurable)
│   ├── post-spike-stress-endurance.js  # Multi-profile POST (TEST_TYPE env var)
│   ├── post-volume-testing.js        # Volume POST (ITEM_COUNT env var)
│   ├── stress-stages.js              # Parallel scenarios + custom metrics
│   └── stress-comparison.js         # Simple configurable stress baseline
│
├── results/                          # All actual test output (JSON + CSV)
│
├── check_p95.py                      # Python: per-minute p95 console report
└── analyze_endurance.py              # Python: endurance → CSV export
```
