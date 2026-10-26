
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const LIMIT = Number(__ENV.LIMIT || 1000);

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const response = http.get(
    `${BASE_URL}/api/products?page=1&limit=${LIMIT}`
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'returned the requested number of records': (r) => {
      const body = r.json();
      return body.data.length === LIMIT;
    },
  });

  sleep(1);
}
