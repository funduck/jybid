'use strict';

const assert = require('assert');
const bundle = require('../index').bundle;

const casesBundle = {
    'bundle': {
        prepare: {
            '.tmp/a.json': {a: 1, b: {$ref: './b.json#/value'}},
            '.tmp/b.json': {value: 2, a: {$ref: './a.json'}}
        },
        arguments: ['.tmp/b.json'],
        result: {
          "value": 2,
          "a": {
            "a": 1,
            "b": {
              "$ref": "#/value"
            }
          }
        }
    },
    'bundle + inherit': {
        prepare: {
            '.tmp/a.json': {a: 1, b: {$ref: '#/c'}, c: 3},
            '.tmp/b.json': {$inherit: {source: {$ref: './a.json'}}}
        },
        arguments: ['.tmp/b.json', {inherit: true}],
        result: {
          a: 1, b: {$ref: '#/c'}, c: 3
        }
    },
    'bundle + 2 * inherit': {
        prepare: {
            '.tmp/a.json': {a: 1, b: {$ref: '#/c'}, c: 3},
            '.tmp/b.json': {b: {$inherit: {source: {$ref: './a.json'}}}},
            '.tmp/c.json': {$inherit: {source: {$ref: './b.json'}}},
        },
        arguments: ['.tmp/c.json', {inherit: true}],
        result: {
          b: {a: 1, b: {$ref: '#/b/c'}, c: 3}
        }
    }
};

describe('Jybid bundle file', function () {
    const fs = require('fs');

    before(() => {
        if (!fs.existsSync('.tmp')) fs.mkdirSync('.tmp')
    })
    after(() => {
        fs.rmdirSync('.tmp')
    })

    for (const name in casesBundle) {
        it(name, (done) => {
            let error;
            for (const path in casesBundle[name].prepare) {
                fs.writeFileSync(path, JSON.stringify(casesBundle[name].prepare[path]), {encoding: 'utf8'});
            }
            bundle(...casesBundle[name].arguments)
            .then((res) => {
                assert.deepEqual(res, casesBundle[name].result);
            })
            .catch((e) => {
                error = e;
            })
            .then(() => {
                for (const path in casesBundle[name].prepare) {
                    fs.unlinkSync(path);
                }
                error ? done(error) : done();
            });
        });
    }
});

