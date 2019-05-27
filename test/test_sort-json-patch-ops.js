'use strict';

const assert = require('assert');
const sortJsonPatchOps = require('../sort-json-patch-ops');

const cases = {
    'ops priority': {
        arguments: [
            [
                {"op": "add", "path": "/arr/-", "value": 1},
                {"op": "remove", "path": "/arr/1"}
            ]
        ],
        result: [
            {"op": "remove", "path": "/arr/1"},
            {"op": "add", "path": "/arr/-", "value": 1}
        ]
    },
    'remove pathes': {
        arguments: [
            [
                {"op": "remove", "path": "/arr/2"},
                {"op": "remove", "path": "/arr/12"}
            ]
        ],
        result: [
            {"op": "remove", "path": "/arr/12"},
            {"op": "remove", "path": "/arr/2"}
        ]
    }
};

describe('Sort json patch ops', function () {
    for (const name in cases) {
        it(name, () => {
            const res = sortJsonPatchOps(...cases[name].arguments)
            assert.deepEqual(res, cases[name].result);
        });
    }
});

