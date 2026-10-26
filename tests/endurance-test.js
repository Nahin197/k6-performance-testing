
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '30s', target: 0 },
  ],
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
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
