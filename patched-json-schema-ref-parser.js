const $RefParser = require('json-schema-ref-parser');
module.exports = $RefParser;

/**
    Purpose of this module is to protect $inherit.with from resolving references
    Bundle checks $ref's and fails when comes to JSON Patch document, so here we decorate 'resolve' and 'bundle' methods
*/

/**
    Set custom $inherit word
*/
$RefParser.prototype.setJybidInheritWord = function (word) {
    this._jybid_inherit_word = word || '$inherit';
};

$RefParser.PROTECTED_REF = 'this_$ref_is_protected_from_bundle';

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

$RefParser.prototype._jybid_protectLocalRefsFromBundle = function (doc, protect) {
    if (typeof doc != 'object' || doc == null) return doc;
    
    if (Array.isArray(doc)) {
        for (let i = 0; i < doc.length; i++) {
            this._jybid_protectLocalRefsFromBundle(doc[i], protect);
        }
    } else {
        const refKey = protect ? '$ref' : $RefParser.PROTECTED_REF;
        Object.keys(doc).forEach((key) => {
            if (key == refKey && typeof doc[key] == 'string' && doc[key].match(/^#\//)) {
                return;
            }
            this._jybid_protectLocalRefsFromBundle(doc[key], protect);
        });

        
        if (typeof doc[refKey] == 'string' && doc[refKey].match(/^#\//)) {
            if (protect) {
                doc[$RefParser.PROTECTED_REF] = doc.$ref;
                delete doc.$ref;
            } else {
                doc.$ref = doc[$RefParser.PROTECTED_REF];
                delete doc[$RefParser.PROTECTED_REF];
            }
        }
    }
};

$RefParser.prototype._jybid_protectInheritFromBundle = function (doc, protect) {
    if (typeof doc != 'object' || doc == null) return doc;
    
    if (this._jybid_inherit_word == null) {
        this.setJybidInheritWord();
    }
    
    if (Array.isArray(doc)) {
        for (let i = 0; i < doc.length; i++) {
            this._jybid_protectInheritFromBundle(doc[i], protect);
        }
    } else {
        Object.keys(doc).forEach((key) => {
            if (key != this._jybid_inherit_word) {
                this._jybid_protectInheritFromBundle(doc[key], protect);
            }
        });
        if (doc[this._jybid_inherit_word] != null) {
            this._jybid_protectInheritFromBundle(doc[this._jybid_inherit_word].source, protect);
            this._jybid_protectLocalRefsFromBundle(doc[this._jybid_inherit_word].with, protect);
        }
    }
    return doc;
}

$RefParser.prototype._jybid_resolve = $RefParser.prototype.resolve;

$RefParser.prototype.resolve = function (path, schema, options, callback) {
    const promise = this._jybid_resolve(path, schema, options)
    .then((resolved) => {
        resolved.paths().forEach((path) => {
            const doc = resolved.get(path);
            const protectedDoc = this._jybid_protectInheritFromBundle(doc, true);
            resolved.set(path, protectedDoc);
        });
        return maybe(null, resolved, callback);
    })
    .catch((e) => {
        maybe(e, null, callback);
    });
    
    if (callback == null) return promise;
};

$RefParser.prototype._jybid_bundle = $RefParser.prototype.bundle;

$RefParser.prototype.bundle = function (path, schema, options, callback) {
    const promise = this._jybid_bundle(path, schema, options)
    .then((bundled) => {
        this._jybid_protectInheritFromBundle(bundled, false);
        return maybe(null, bundled, callback);
    })
    .catch((e) => {
        maybe(e, null, callback);
    });
    
    if (callback == null) return promise;
};
