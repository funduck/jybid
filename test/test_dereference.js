'use strict';

const assert = require('assert');
const dereference = require('../index').dereference;

const casesDereference = {
    'no inherit': {
        arguments: [
            {a: 1, b: {b: 2, arr: [3, 4, 's']}},
            {inherit: '$MY_inherit'}
        ],
        result: {a: 1, b: {b: 2, arr: [3, 4, 's']}}
    },
    'inherit with no changes': {
        arguments: [
            {
                $inherit: {
                    source: {a: 1, b: {b: 2, arr: [3, 4, 's']}}
                }
            },
            {inherit: true}
        ],
        result: {a: 1, b: {b: 2, arr: [3, 4, 's']}}
    },
    'inherit with no changes and use other code word': {
        arguments: [
            {
                $MY_inherit: {
                    source: {a: 1, b: {b: 2, arr: [3, 4, 's']}}
                }
            }, 
            {inherit: '$MY_inherit'}
        ],
        result: {a: 1, b: {b: 2, arr: [3, 4, 's']}}
    },
    'add property': {
        arguments: [
            {
                $inherit: {
                    source: {a: 1, b: {b: 2, arr: [3, 4, 's']}},
                    with: [{
                        op: 'add', path: '/c', value: 5
                    }]
                }
            },
            {inherit: true}
        ],
        result: {a: 1, b: {b: 2, arr: [3, 4, 's']}, c: 5}
    },
    'replace remove': {
        arguments: [
            {
                $inherit: {
                    source: {a: 1, b: {b: 2, arr: [3, 4, 's']}},
                    with: [{
                        op: 'replace', path: '/a', value: {val: 13}
                    }, {
                        op: 'remove', path: '/b'
                    }]
                }
            },
            {inherit: true}
        ],
        result: {a: {val: 13}}
    },
    '[*] index selector': {
        arguments: [
            {
                $inherit: {
                    source: {
                        a: 1, 
                        arr: [{
                            x: 2
                        }, {
                            x: 3
                        }, {
                            x: 4,
                            arr2: [{
                                x: 5
                            },{
                                x: '5'
                            }]
                        },{
                            copy: true,
                            x: 4,
                            arr2: [{
                                x: 5
                            },{
                                x: '5'
                            }]
                        },{
                            x: '4'
                        }]
                    },
                    with: [{
                        op: 'add', path: '/arr/[x=2]/found', value: true
                    },{
                        op: 'add', path: '/arr/[x=4][copy=true]/arr2/[x=5]/found', value: true
                    }]
                }
            },
            {inherit: true}
        ],
        result: {
            a: 1, 
            arr: [{
                x: 2,
                found: true
            }, {
                x: 3
            }, {
                x: 4,
                arr2: [{
                    x: 5
                },{
                    x: '5'
                }]
            }, {
                copy: true,
                x: 4,
                arr2: [{
                    x: 5,
                    found: true
                },{
                    x: '5'
                }]
            },{
                x: '4'
            }]
        }
    }
};

describe('Jybid dereference object', function () {
    for (const name in casesDereference) {
        it(name, (done) => {
            dereference(...casesDereference[name].arguments)
            .then((res) => {
                assert.deepEqual(res, casesDereference[name].result);
                done();
            })
            .catch(done);
        });
    }
    
    it('fail on unresolved $ref', (done) => {
        dereference({
            $inherit: {
                source: {
                    $ref: 'unresolved reference.json'
                }
            }
        }, {
            inherit: true
        })
        .then(() => {
            done(new Error('not failed'));
        })
        .catch((e) => {
            try {
                assert.equal(e.message, 'inherit: all outer references \'$ref\' must be resolved!');
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    
    it('fail without "source" property', (done) => {
        dereference({
            $inherit: {}
        }, {
            inherit: true
        })
        .then(() => {
            done(new Error('not failed'));
        })
        .catch((e) => {
            try {
                assert.equal(e.message, `inherit: $inherit.source is null!`);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    
    it('fail if selector compiles to multiple operations', (done) => {
        dereference({
            $inherit: {
                source: {
                    arr: [{k:1, l: 1}, {k: 1, l: 2}]
                },
                with: [{op: 'replace', path: '/arr/[k=]/l', value: 3}]
            }
        }, {
            inherit: true
        })
        .then(() => {
            done(new Error('not failed'));
        })
        .catch((e) => {
            try {
                assert(e.message.match('compiles to selector that has multiple matches, it is forbidden'));
                done();
            } catch (e) {
                done(e);
            }
        });
    });
});

