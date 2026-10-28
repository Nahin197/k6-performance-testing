
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';

// Separate custom metrics for each workload.
const duration10 = new Trend('response_time_10_vus', true);
const duration20 = new Trend('response_time_20_vus', true);
const duration50 = new Trend('response_time_50_vus', true);

const errors10 = new Rate('error_rate_10_vus');
const errors20 = new Rate('error_rate_20_vus');
const errors50 = new Rate('error_rate_50_vus');

const requests10 = new Counter('requests_10_vus');
const requests20 = new Counter('requests_20_vus');
const requests50 = new Counter('requests_50_vus');

export const options = {
  scenarios: {
    stage_10_vus: {
      executor: 'constant-vus',
      exec: 'test10',
      vus: 10,
      duration: '60s',
      startTime: '0s',
    },
    stage_20_vus: {
      executor: 'constant-vus',
      exec: 'test20',
      vus: 20,
      duration: '60s',
      startTime: '65s',
    },
    stage_50_vus: {
      executor: 'constant-vus',
      exec: 'test50',
      vus: 50,
      duration: '60s',
      startTime: '130s',
    },
  },
};

function sendRequest(durationMetric, errorMetric, requestCounter) {
  const response = http.get(
    `${BASE_URL}/api/products?page=1&limit=20`
  );

  durationMetric.add(response.timings.duration);
  errorMetric.add(response.status === 0 || response.status >= 400);
  requestCounter.add(1);

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(0.5);
}

export function test10() {
  sendRequest(duration10, errors10, requests10);
}

export function test20() {
  sendRequest(duration20, errors20, requests20);
}

export function test50() {
  sendRequest(duration50, errors50, requests50);
}
