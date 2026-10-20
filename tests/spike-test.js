
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '5s', target: 50 },
    { duration: '30s', target: 50 },
    { duration: '5s', target: 5 },
    { duration: '30s', target: 5 },
    { duration: '5s', target: 0 },
  ],
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
