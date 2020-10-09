const jsonPtr = require('json-ptr');
const JsonSchemaRefParser = require('json-schema-ref-parser');

/**
    Purpose of this module is to protect $inherit.with from resolving local references inside it
    Bundle checks $ref's and fails when comes to JSON Patch document, so here we decorate 'resolve' and 'bundle' methods
*/

const PROTECTED_REF = 'this_$ref_is_protected_from_bundle';

const maybe = (err, res, callback) => {
    if (callback) {
        callback(err, res);
    } else {
        if (err) {
            throw err;
        } else {
            return res;
        }
    }    
};

const unprotectRef = (doc) => {
    if (PROTECTED_REF in doc) {
        doc.$ref = doc[PROTECTED_REF];
        delete doc[PROTECTED_REF];
    }
};

const protectRef = (doc) => {
    if ('$ref' in doc) {
        doc[PROTECTED_REF] = doc.$ref;
        delete doc.$ref;
    }
};

const inNodes = function (prefix, suffix, root, doc, cb) {
    if (typeof doc != 'object' || doc == null) return;
    
    if (Array.isArray(doc)) {
        for (let i = 0; i < doc.length; i++) {
            inNodes(prefix, suffix, root, doc[i], cb);
        }
    } else {
        Object.keys(doc).forEach((key) => {
            inNodes(prefix, suffix, root, doc[key], cb);
            if (key == prefix) {
                if (suffix) {
                    cb(doc[prefix]);
                } else {
                    cb(doc);
                }
            }
        });
    }
    return;
}

class PatchedJsonSchemaRefParser extends JsonSchemaRefParser {
    /**
        Set custom word instead of '$inherit'
    */
    setJybidInheritWord(word) {
        this._jybid_inherit_word = word || '$inherit';
    }

    _jybid_processResolved(doc) {
        if (this._jybid_inherit_word == null) {
            this.setJybidInheritWord();
        }
        // refs to #/... in $inherit/... should be preserved till the end
        // because it is what can be body of json-patch operations
        const re_local = /^#\//;
        inNodes(this._jybid_inherit_word, null, doc, doc, (node) => {
            inNodes('$ref', null, doc, node, (_node) => {
                if (_node.$ref.match(re_local)) {
                    //console.error('protectRef', _node)
                    protectRef(_node);
                }
            });
        });
    }

    _jybid_processBundled(doc) {
        inNodes(PROTECTED_REF, null, doc, doc, unprotectRef);
    }

    resolve(path, schema, options, callback) {
        const promise = super.resolve(path, schema, options)
        .then((resolved) => {
            resolved.paths().forEach((_path) => {
                const doc = resolved.get(_path);
                //console.error('this._jybid_processResolved', JSON.stringify(doc, null, '  '))
                if (path) {
                    this._jybid_processResolved(doc);
                }
                resolved.set(_path, doc);
            });
            //console.error('resolved', JSON.stringify(resolved, null, '  '))
            return maybe(null, resolved, callback);
        })
        .catch((e) => {
            e.message = `In resolve(path="${path}") ` + e.message;
            maybe(e, null, callback);
        });
        
        if (callback == null) return promise;
    }

    bundle(path, schema, options, callback) {
        const promise = super.bundle(path, schema, options)
        .then((bundled) => {
            //console.error('bundled', JSON.stringify(bundled, null, '  '))
            this._jybid_processBundled(bundled);
            return maybe(null, bundled, callback);
        })
        .catch((e) => {
            e.message = `In bundle(path="${path}") ` + e.message;
            maybe(e, null, callback);
        });
        
        if (callback == null) return promise;
    }
}

module.exports = PatchedJsonSchemaRefParser
