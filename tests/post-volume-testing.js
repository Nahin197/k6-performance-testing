
import http from 'k6/http';
import { check, sleep } from 'k6';

const ITEM_COUNT = Number(__ENV.ITEM_COUNT || 10);

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';


const testType = __ENV.TEST_TYPE || 'load';

const profiles = {
    load: {
        vus: Number(__ENV.VUS || 10),
        duration: __ENV.DURATION || '30s',
    },

    stress: {
        stages: [
            { duration: '20s', target: 10 },
            { duration: '30s', target: 10 },
            { duration: '20s', target: 20 },
            { duration: '30s', target: 20 },
            { duration: '20s', target: 50 },
            { duration: '30s', target: 50 },
            { duration: '20s', target: 0 },
        ],
    },

    spike: {
        stages: [
            { duration: '20s', target: 5 },
            { duration: '5s', target: 50 },
            { duration: '30s', target: 50 },
            { duration: '5s', target: 5 },
            { duration: '30s', target: 5 },
            { duration: '5s', target: 0 },
        ],
    },

    endurance: {
        stages: [
            { duration: '30s', target: 10 },
            { duration: '5m', target: 10 },
            { duration: '30s', target: 0 },
        ],
    },
};

if (!profiles[testType]) {
    throw new Error(`Unknown TEST_TYPE: ${testType}`);
}

export const options = {
    ...profiles[testType],
    thresholds: {
        http_req_failed: ['rate<0.05'],
    },
};


export default function () {

    const payload = JSON.stringify({
        customerId: 1001,
        items: Array.from({ length: ITEM_COUNT }, (_, index) => ({
            productId: (index % 1000) + 1,
            quantity: 1,
        })),
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
