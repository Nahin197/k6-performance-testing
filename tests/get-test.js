
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const response = http.get(
    `${BASE_URL}/api/products?page=1&limit=20`
  );

  check(response, {
    'GET returns 200': (r) => r.status === 200,
    'response contains product data': (r) => {
      const body = r.json();
      return Array.isArray(body.data) && body.data.length === 20;
    },
    'response time below 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
