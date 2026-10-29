
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '30s',

  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const payload = JSON.stringify({
    customerId: 1001,
    items: [
      {
        productId: 1,
        quantity: 2,
      },
      {
        productId: 2,
        quantity: 1,
      },
    ],
  });

  const response = http.post(
    `${BASE_URL}/api/orders`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: {
        endpoint: 'create_order',
      },
    }
  );

  check(response, {
    'POST returns 201': (r) => r.status === 201,
    'response contains order ID': (r) => {
      try {
        return Number.isInteger(r.json().id);
      } catch {
        return false;
      }
    },
    'response time below 500ms': (r) => r.timings.duration < 500,
  });

  sleep(0.5);
}
