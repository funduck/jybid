'use strict';

const fs = require('fs');
const jsonPatch = require('rfc6902');
const RefParser = require('./patched-json-schema-ref-parser');
const jps = require('./json-pointer-selectors');
const { JsonPointer } = require('json-ptr');
const clone = require('./clone');

/**
    @param {object} doc
    @param {object} options
    @param {boolean|string} options.inherit - code word or boolean, if TRUE then code word wil be "$inherit"
    @param {function} options.compileJsonPatch - custom compiler
    
    @return {object} doc - modified source
*/
const applyInherit = function (doc, options, rootDoc, inWith) {
    if (typeof doc != 'object' || doc == null) return doc;
   
    rootDoc = rootDoc || doc;
    options = options || {};
    if (options.inherit == null) {
        return doc;
    }
    if (options.inherit === true) {
        options.inherit = '$inherit';
    }

    const $inherit = options.inherit;
    const _inherit = encodeURIComponent($inherit);
    const re_inherit = new RegExp(`\/${_inherit}\/source`, 'g');
    const _source = `${_inherit}\/source`; 
    const re_source = new RegExp(`^(.*\/)${_source}\/?(.*)`);
    const _with = `${_inherit}\/with`; 
    const re_with = new RegExp(`^(.*\/)${_with}\/?(.*)`);

    if (Array.isArray(doc)) {
        for (let i = 0; i < doc.length; i++) {
            doc[i] = applyInherit(doc[i], options, rootDoc, inWith);
        }
    } else {
        for (const key in doc) {
            if (key == '$ref') {
                if (!doc.$ref.match(/^#/)) {
                    throw new Error('inherit: all outer references \'$ref\' must be resolved!');
                } else {
                    // if internal references are like '/$inherit/source*' we just bring the document
                    // because after applying json-patch these references will be invalid
                    const re = doc.$ref.match(re_source);
                    if (re) {
//console.error('found source ref', doc)
                        // pointer to whole document under key 'source'
                        if (inWith || !re[2]) {
//console.error('cloning document', doc.$ref, re, re_source)
                            return clone(JsonPointer.get(rootDoc, doc.$ref));
                        } else {
//console.error('replacing $ref', doc.$ref, re, re_source)
                            doc.$ref = doc.$ref.replace(re_inherit, '');
                        }
                    } else {
                        // if internal references are like '/$inherit/with*' we just bring the document
                        // because after applying json-patch these references will be invalid
                        const re = doc.$ref.match(re_with);
                        if (re) {
//console.error('found with ref', doc)
                            // pointer to whole document under key 'source'
//console.error('cloning document', doc.$ref, re, re_with)
                            return clone(JsonPointer.get(rootDoc, doc.$ref));
                        }
                    }
                }
            }
            if (key in doc) {
                doc[key] = applyInherit(doc[key], options, rootDoc, key == 'with' || inWith);
            }
        }
        if (doc[$inherit]) {
            const inh = doc[$inherit];
            if (inh.source == null) {
                throw new Error(`inherit: ${$inherit}.source is null!`);
            }
            if (!(inh.with == null || Array.isArray(inh.with) && inh.with.length == 0)) {
//console.log(options.compileJsonPatch, 'SOURCE:', inh.source, 'WITH:', inh.with)
                inh.with.forEach(op => {
                    const patch = (options.compileJsonPatch || jps.compileJsonPatch)(inh.source, [op])
//console.log('PATCH', patch)
                    jsonPatch.applyPatch(
                        inh.source, 
                        patch
                    );
                });
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
//console.error('Bundle()')
    if (!fs.existsSync(filepath)) {
        return new Promise((res, rej) => rej(new Error(`invalid argument: file "${filepath}" not exists`)));
    }
    options = options || {};
    const parser = new RefParser();
    if (typeof options.inherit == 'string') {
        parser.setJybidInheritWord(options.inherit);
    }
    return parser.bundle(filepath)
    .then((doc) => {
        try {
            doc = applyInherit(doc, options);
        } catch (e) {
            console.error('inherit', 'doc:', JSON.stringify(doc, null, '  '), 'error:', e);
            throw e;
        }
        return doc;
    })
    .catch((e) => {
        console.error('bundle', 'filepath:', filepath, 'error:', e);
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
//console.error('Dereference()')
    if (typeof doc == 'string') {
        return bundle(doc, options)
        .then((doc) => {
            return dereference(doc);
        });
    }
    try {
        doc = applyInherit(doc, options);
    } catch (e) {
        console.error('inherit', 'doc:', doc, 'error:', e);
        return new Promise(function(resolve, reject) {
            reject(e);
        });
    }
    return RefParser.dereference(doc)
    .catch((e) => {
        console.error('dereference', 'doc:', doc, 'error:', e);
        throw e;
    });
};

module.exports = { bundle, dereference };

if (process.argv[1] == module.filename) {
    let cmd;
    switch (process.argv[2]) {
        case 'bundle':
        case 'dereference': {
            cmd = process.argv[2];
            break;
        }
        default: {
            console.log(
`Usage: node index.js COMMAND --file FILENAME [--inherit CODEWORD]
Commands:
    bundle                resolve external references
    dereference           resolve all references
Options:
    --inherit CODEWORD    if 'false' is passed, no inheritance will be compiled
                          if any word is passed it will be used instead of default '$inherit'
                          if option is not used default '$inherit' is used and inheritance is compiled
Examples:
    node index.js bundle --file filename1.json
    node index.js bundle --file filename2.json --inherit false
    node index.js dereference --file filename3.json --inherit patch`);
            process.exit(0);
            break;
        }
    }

    if (process.argv[3] != '--file') {
        console.error('invalid option, run with --help');
        process.exit(1);
    }

    const fs = require('fs');
    const path = require('path');
    const fname = path.resolve(__dirname, process.argv[4]);

    if (!fs.existsSync(fname)) {
        console.error(`file ${fname} not found`);
        process.exit(1);
    }

    let inherit = true;
    if (process.argv[5] == '--inherit') {
        inherit = process.argv[6] == 'false' ? false : 
            process.argv[6] == 'true' ? true : process.argv[6];
    }

    module.exports[cmd](fname, { inherit })
    .then((res) => {
        console.log(JSON.stringify(res, null, '  '));
    })
    .catch((e) => {
        console.error(e.stack);
        process.exit(1);
    });
}
