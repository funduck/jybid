'use strict';

const assert = require('assert');
const jybid = require('../index');

const date = new Date();

const cases = {
    'patch without $ref\'s': {
        op: 'bundle',
        prepare: {
            '/tmp/a.json': {a: 1, b: {$ref: '#/c'}, c: 3},
            '/tmp/b.json': {$inherit: {
                source: {$ref: './a.json'},
                with: [{
                    op: 'replace', path: '/a', value: 11
                }]
            }}
        },
        arguments: ['/tmp/b.json', {inherit: true}],
        result: {
          a: 11, b: {$ref: '#/c'}, c: 3
        }
    },
    'patch with internal $ref': {
        op: 'bundle',
        prepare: {
            '/tmp/a.json': {a: 1, b: {$ref: '#/c'}, c: 3},
            '/tmp/b.json': {$inherit: {
                source: {$ref: './a.json'},
                with: [{
                    op: 'replace', path: '/a', value: {$ref: '#/c'}
                }, {
                    op: 'add', path: '/d', value: {obj: [{$ref: '#/c'}]}
                }]
            }}
        },
        arguments: ['/tmp/b.json', {inherit: true}],
        result: {
          a: {$ref: '#/c'}, b: {$ref: '#/c'}, c: 3, d: {obj: [{$ref: '#/c'}]}
        }
    },
    'patch with internal $ref (custom word $INHERIT)': {
        op: 'bundle',
        prepare: {
            '/tmp/a.json': {a: 1, b: {$ref: '#/c'}, c: 3},
            '/tmp/b.json': {$INHERIT: {
                source: {$ref: './a.json'},
                with: [{
                    op: 'replace', path: '/a', value: {$ref: '#/c'}
                }]
            }}
        },
        arguments: ['/tmp/b.json', {inherit: '$INHERIT'}],
        result: {
          a: {$ref: '#/c'}, b: {$ref: '#/c'}, c: 3
        }
    },
    'patch with internal $ref (duplicate to check that default $inherit word works)': {
        op: 'bundle',
        prepare: {
            '/tmp/a.json': {a: 1, b: {$ref: '#/c'}, c: 3},
            '/tmp/b.json': {$inherit: {
                source: {$ref: './a.json'},
                with: [{
                    op: 'replace', path: '/a', value: {$ref: '#/c'}
                }]
            }}
        },
        arguments: ['/tmp/b.json', {inherit: true}],
        result: {
          a: {$ref: '#/c'}, b: {$ref: '#/c'}, c: 3
        }
    },
    'dereference file with patch with internal $ref': {
        op: 'dereference',
        prepare: {
            '/tmp/a.json': {a: 1, b: {$ref: '#/c'}, c: 3},
            '/tmp/b.json': {$inherit: {
                source: {$ref: './a.json'},
                with: [{
                    op: 'replace', path: '/a', value: [{$ref: '#/c'}]
                }]
            }}
        },
        arguments: ['/tmp/b.json', {inherit: true}],
        result: {
          a: [3], b: 3, c: 3
        }
    },
    'more 1 inheritance': {
        op: 'bundle',
        prepare: {
            '/tmp/a.json': {a: 1, b: {$ref: '#/c'}, c: 3, d: []},
            '/tmp/b.json': {$inherit: {
                source: {$ref: './a.json'},
                with: [{
                    op: 'replace', path: '/a', value: {$ref: '#/c'}
                }, {
                    op: 'add', path: '/d/-', value: {$ref: '#/c'}
                }, {
                    op: 'add', path: '/d/-', value: {$ref: '#/b'}
                }]
            }},
            '/tmp/c.json': {$inherit: {
                source: {$ref: './b.json'},
                with: [{
                    op: 'replace', path: '/a', value: {$ref: '#/b'}
                }, {
                    op: 'remove', path: '/d/[$ref=#/c]'
                }, {
                    op: 'remove', path: '/d/[$ref=#/b]'
                }]
            }}
        },
        arguments: ['/tmp/c.json', {inherit: true}],
        result: {
          a: {$ref: '#/b'}, b: {$ref: '#/c'}, c: 3, d: []
        }
    },
}

describe('Jybid bundle and dereference file with JSON Patch inheritance', function () {
    const fs = require('fs');

    for (const name in cases) {
        const test = cases[name];
        it(name, (done) => {
            let error;
            for (const path in test.prepare) {
                fs.writeFileSync(path, JSON.stringify(test.prepare[path]), {encoding: 'utf8'});
            }
            jybid[test.op](...test.arguments)
            .then((res) => {
                assert.deepEqual(res, test.result);
            })
            .catch((e) => {
                error = e;
            })
            .then(() => {
                for (const path in test.prepare) {
                    fs.unlinkSync(path);
                }
                error ? done(error) : done();
            });
        });
    }
});

