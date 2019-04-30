'use strict';

const refParser = require('json-schema-ref-parser');
const jsonPatch = require('rfc6902');
const jsonPtr = require('json-ptr');
const jps = require('./json-pointer-selectors');

const pathRegex = new RegExp(/^((?:\/.+?)*?)\/((?:\[.*?=.*?\])+)($|\/.*$)/);
const kvRegex = new RegExp(/\[(.*?)=(.*?)\]/g);

const matchesConditions = function (obj, conditions) {
//    console.log(obj, conditions)
    let c;
    for (let i = 0; i < conditions.length; i++) {
        c = conditions[i];
        if (c.key != null && c.value != null && obj[c.key] !== c.value ||
            c.key != null && c.value == null && obj[c.key] == undefined ||
            c.key == null && c.value != null && obj !== c.value
        ) {
            return false;
        }
    }
    return true;
};

const compilePatchOps = function (source, ops) {
    const res = [];
    for (let i = 0; i < ops.length; i++) {
        if (!ops[i].path) continue;

        const re = jps.parsePath(ops[i].path);
        if (re.selector) {
            const arr = jsonPtr.get(source, re.prefix);
            let tmp = [];
            // if object is not array check deeper
            if (!Array.isArray(arr)) {
                if (arr[re.infix] != undefined && re.suffix != '') {
                    // relative pathes
                    tmp = compilePatchOps(arr[re.infix], [Object.assign({}, ops[i], {path: re.suffix})]);
                    for (let j = 0;j < tmp.length; j++) {
                        // relative pathes back to absolute
                        tmp[j].path = re.prefix + re.infix + tmp[j].path;
                        res.push(tmp[j]);
                    }
                } else {
                    res.push(ops[i]);
                }
                continue;
            }
//            console.log('array');
            // if found array check conditions
            for (let j = 0; j < arr.length; j++) {
                if (matchesConditions(arr[j], re.selector)) {
                    // changing path to JSON-Pointer with number
                    tmp.push(Object.assign({}, ops[i], {path: re.prefix + '/' + j + re.suffix}));
                }
            }
            if (tmp.length) {
//                console.log('array, checking deeper', tmp);
                // checking new pathes deeper
                tmp = compilePatchOps(source, tmp);
            }
            if (tmp.length) {
                res.push(...tmp);
            }
        } else {
            res.push(ops[i]);
        }
    }
    return res;
};

const inherit = function (doc, options) {
    options = options || {};
    if (options.inherit == null) {
        return doc;
    }
    if (options.inherit === true) {
        options.inherit = '$inherit';
    }
    if (typeof doc == 'object' && doc.constructor.name == 'Object') {
        Object.keys(doc).forEach((key) => {
            if (key == '$ref') {
                if (!doc.$ref.match(/^#/)) {
                    throw new Error('inherit: all outer references \'$ref\' must be resolved!');
                } else {
                    // fix internal references, if they have '/$inherit/source', it is correct for bundling
                    // but we are going to move object 2 levels up, so it won't be correct
                    doc.$ref = doc.$ref.replace(new RegExp(`\/${encodeURIComponent(options.inherit)}\/source`, 'g'), '');
                }
            }
            doc[key] = inherit(doc[key], options);
        });
        if (options.inherit && doc[options.inherit]) {
            const inh = doc[options.inherit];
            if (inh.source == null) {
                throw new Error(`inherit: ${options.inherit}.source is null!`);
            }
            if (!(inh.with == null || Array.isArray(inh.with) && inh.with.length == 0)) {
                jsonPatch.applyPatch(inh.source, compilePatchOps(inh.source, inh.with));
            }
            doc = inh.source;
        }
    }
    return doc;
};

const bundle = function (filepath, options) {
    return refParser.bundle(filepath)
    .then((doc) => {
        try {
            doc = inherit(doc, options);
        } catch (e) {
            console.error('inherit', doc, e);
            throw e;
        }
        return doc;
    })
    .catch((e) => {
        console.error('bundle', filepath, e);
        throw e;
    });
};

const dereference = function (doc, options) {
    if (typeof doc == 'string') {
        return bundle(doc, options)
        .then((doc) => {
            return dereference(doc);
        });
    }
    try {
        doc = inherit(doc, options);
    } catch (e) {
        console.error('inherit', doc, e);
        return new Promise(function(resolve, reject) {
            reject(e);
        });
    }
    return refParser.dereference(doc)
    .catch((e) => {
        console.error('dereference', doc, e);
        throw e;
    });
};

module.exports = { bundle, dereference, compilePatchOps, matchesConditions };
