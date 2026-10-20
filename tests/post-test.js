
import http from 'k6/http';
import { check } from 'k6';

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
  const payload = JSON.stringify({
    customerId: 1001,
    items: [
      {
        productId: 1,
        quantity: 2,
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
    }
  );

  check(response, {
    'POST returns 201': (r) => r.status === 201,
    'response includes order ID': (r) => {
      const body = r.json();
      return Number.isInteger(body.id);
    },
    'order customer ID is correct': (r) => {
      return r.json().customerId === 1001;
    },
  });
}
