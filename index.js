'use strict';

const jsonPatch = require('rfc6902');
const refParser = require('./patched-json-schema-ref-parser');
const jps = require('./json-pointer-selectors');

/**
    @param {object} doc
    @param {object} options
    @param {boolean|string} options.inherit - code word or boolean, if TRUE then code word wil be "$inherit"
    @param {function} options.compileJsonPatch - custom compiler
    
    @return {object} doc - modified source
*/
const inherit = function (doc, options) {
    if (typeof doc != 'object' || doc == null) return doc;
    
    options = options || {};
    if (options.inherit == null) {
        return doc;
    }
    if (options.inherit === true) {
        options.inherit = '$inherit';
    }
    if (Array.isArray(doc)) {
        for (let i = 0; i < doc.length; i++) {
            doc[i] = inherit(doc[i], options);
        }
    } else {
        for (const key in doc) {
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
        }
        if (options.inherit && doc[options.inherit]) {
            const inh = doc[options.inherit];
            if (inh.source == null) {
                throw new Error(`inherit: ${options.inherit}.source is null!`);
            }
            if (!(inh.with == null || Array.isArray(inh.with) && inh.with.length == 0)) {
                const patch = (options.compileJsonPatch || jps.compileJsonPatch)(inh.source, inh.with)
                jsonPatch.applyPatch(
                    inh.source, 
                    patch
                );
            }
            doc = inh.source;
        }
    }
    return doc;
};

/**
    @param {string} filepath
    @param {object} options
    @param {boolean|string} options.inherit - code word or boolean, if TRUE code word will be "$inherit" if FALSE no inheritance will be resolved
    @param {function} options.compileJsonPatch - custom compiler
    
    @return {Promise.<object>}
*/
const bundle = function (filepath, options) {
    options = options || {};
    const parser = new refParser();
    if (typeof options.inherit == 'string') {
        parser.setJybidInheritWord(options.inherit);
    }
    return parser.bundle(filepath)
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

/**
    @param {string|object} doc - filepath or bundled document
    @param {object} options
    @param {boolean|string} options.inherit - code word or boolean, if TRUE code word will be "$inherit" if FALSE no inheritance will be resolved
    @param {function} options.compileJsonPatch - custom compiler
    
    @return {Promise.<object>}
*/
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

module.exports = { bundle, dereference };
