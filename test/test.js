'use strict';

const assert = require('assert');
const bundle = require('../index').bundle;
const dereference = require('../index').dereference;
const compilePatchOps = require('../index').compilePatchOps;
const matchesConditions = require('../index').matchesConditions;

const date = new Date();

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
                        op: 'add', path: '/arr/[x=4]/arr2/[x=5]/found', value: true
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
                    x: 5,
                    found: true
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

const casesBundle = {
    'bundle': {
        prepare: {
            '/tmp/a.json': {a: 1, b: {$ref: './b.json#/value'}},
            '/tmp/b.json': {value: 2, a: {$ref: './a.json'}}
        },
        arguments: ['/tmp/b.json'],
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
            '/tmp/a.json': {a: 1, b: {$ref: '#/c'}, c: 3},
            '/tmp/b.json': {$inherit: {source: {$ref: './a.json'}}}
        },
        arguments: ['/tmp/b.json', {inherit: true}],
        result: {
          a: 1, b: {$ref: '#/c'}, c: 3
        }
    },
    'bundle + 2 * inherit': {
        prepare: {
            '/tmp/a.json': {a: 1, b: {$ref: '#/c'}, c: 3},
            '/tmp/b.json': {b: {$inherit: {source: {$ref: './a.json'}}}},
            '/tmp/c.json': {$inherit: {source: {$ref: './b.json'}}},
        },
        arguments: ['/tmp/c.json', {inherit: true}],
        result: {
          b: {a: 1, b: {$ref: '#/b/c'}, c: 3}
        }
    }
};

describe('json-schema-inherit', function() {
    describe('Dereference object', function () {
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
        
        it.skip('fail on unresolved $ref', (done) => {
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
        
        it.skip('fail without "source" property', (done) => {
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
    });
    
    describe('Bundle file', function () {
        const fs = require('fs');
        for (const name in casesBundle) {
            it(name, (done) => {
                for (const path in casesBundle[name].prepare) {
                    fs.writeFileSync(path, JSON.stringify(casesBundle[name].prepare[path]), {encoding: 'utf8'});
                }
                bundle(...casesBundle[name].arguments).then((res) => {
                    assert.deepEqual(res, casesBundle[name].result);
                    done();
                }).catch(done);
            });
        }
    });
    
    describe('JSON-Patch compiling', function () {
        it('compilePatchOps', () => {
            const cpo = compilePatchOps({arr: [1,'2',{c:3},{d:'4'},{d:'5'},{"1 2 ":6},{r:[7,8]}]}, [{
                op: 'remove', path: '/arr/[=1]'     },{
                op: 'remove', path: '/arr/[="2"]'   },{
                op: 'remove', path: '/arr/[c=3]'    },{
                op: 'remove', path: '/arr/[d="4"]'  },{
                op: 'remove', path: '/arr/[d=]'     },{
                op: 'remove', path: '/arr/[1 2 =]'  },{
                op: 'remove', path: '/arr/["1 2 "=]'},{
                op: 'remove', path: '/arr/[r=]/r/[=7]'
            }]);
            const res = [{
                op: 'remove', path: '/arr/0'    },{
                op: 'remove', path: '/arr/1'    },{
                op: 'remove', path: '/arr/2'    },{
                op: 'remove', path: '/arr/3'    },{
                op: 'remove', path: '/arr/3'    },{
                op: 'remove', path: '/arr/4'    },{
                op: 'remove', path: '/arr/5'    },{
                op: 'remove', path: '/arr/5'    },{
                op: 'remove', path: '/arr/6/r/0'
            }];
            try {
                assert.deepEqual(
                    cpo,
                    res
                );
            } catch (e) {
                console.log('result:', JSON.stringify(cpo, null, '  '))
                console.log('should be:', JSON.stringify(res, null, '  '))
                throw e;
            }
        });
        
        it('matchesConditions', () => {
            const cases = {
                1: {
                    obj: 1,
                    conditions: [{key:null,value:1}]
                },
                '2': {
                    obj: '2',
                    conditions: [{key:null,value:'2'}]
                },
                3:  {
                    obj: {c: 3},
                    conditions: [{key:'c',value:3}]
                },
                4:  {
                    obj: {d: '4'},
                    conditions: [{key:'d',value:'4'}]
                },
                5:  {
                    obj: {c: 3},
                    conditions: [{key:'c',value:null}]
                },
                6:  {
                    obj: {c: 3, d: '4'},
                    conditions: [{key:'c',value:3},{key:'d',value:'4'}]
                }
            };
            for (const k in cases) {
                assert(matchesConditions(cases[k].obj, cases[k].conditions), k);
            }
        });
        
        it('not matchesConditions', (done) => {
            const cases = {
                1: {
                    obj: 2,
                    conditions: [{key:null,value:1}]
                },
                '2': {
                    obj: 2,
                    conditions: [{key:null,value:'2'}]
                },
                3:  {
                    obj: {c: '3'},
                    conditions: [{key:'c',value:3}]
                },
                4:  {
                    obj: {d: '5'},
                    conditions: [{key:'d',value:'4'}]
                },
                5:  {
                    obj: {d: 3},
                    conditions: [{key:'c',value:null}]
                },
                6:  {
                    obj: {c: 3, d: '4'},
                    conditions: [{key:'c',value:3},{key:'d',value:'5'}]
                }
            };
            let ok = true;
            for (const k in cases) {
                try {
                    assert(matchesConditions(cases[k].obj, cases[k].conditions), k);
                    console.error('returned true in case:', k);
                    ok = false;
                    break;
                } catch (e) {
                }
            }
            if (ok) done(); else done(new Error('some tests failed'));
        });
    });
});
