
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: '60s',

  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const response = http.get(
    `${BASE_URL}/api/products?page=1&limit=20`
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(0.5);
}
