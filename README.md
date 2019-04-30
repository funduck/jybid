# JYBID - json-yaml-bundle-inherit-dereference
Bundling/extending documents with JSON-Patch

## Bundle & Dereference
Library exports **bundle(filepath, options)** and **dereference(filepath, options)**, both if `options.inherit` is passed compile json-patches, for example:
```
const { bundle, dereference } = require('./index')
const fs = require('fs')
fs.writeFileSync('/tmp/a.json', JSON.stringify({
    a: 1, 
    c: {$ref: '#/d'}, 
    d: 4
}), {encoding: 'utf8'})
fs.writeFileSync('/tmp/b.json', JSON.stringify({
    $inherit: {
        source: {$ref: '/tmp/a.json'},
        with: [{op: 'add', path: '/b', value: 2}]
    }
}), {encoding: 'utf8'})
bundle('/tmp/a.json').then((doc) => {console.log(JSON.stringify(doc));})
{"a":1,"c":{"$ref":"#/d"},"d":4}
bundle('/tmp/b.json', {inherit: true}).then((doc) => {console.log(JSON.stringify(doc));})
{"a":1,"c":{"$ref":"#/d"},"d":4,"b":2}
dereference('/tmp/b.json', {inherit: true}).then((doc) => {console.log(JSON.stringify(doc));})
{"a":1,"c":4,"d":4,"b":2}
```

## Better JSON-Patch - [*] path parts for array index
In JSON patch **path** referencing array elements does not look good, which element do we remove here, you never know until you see **object**?
```
object = [1,2,234]
patch = [{op: 'remove', path: '/2'}]
```
We can make **path** better if we select element by its properties, not index, so we'd like to replace numbers with selectors, like jquery selectors
```
patch = [{op: 'remove', path: '/[=234]'}]
/* we compile patch to receive standart */
compilePatchOps(object, patch)
[{op: 'remove', path: '/2'}]
```
Inside `[*]` quotation is used: 
* `\"` to get `"`
* `\\` to get `\`
`/` is `/`, `~` is `~`, not `~1` and `~0`

### select objects with by property value pairs
Value is treated as string if possible and as number if it can't be string
`[prop=value]` == `{prop: 'value'}`
`[prop="13"]` == `{prop: '13'}`
`[prop=42]` == `{prop: 42}`
To reference compicated property name 
`["string attr name"=name]` == `{'string attr name': 'name'}`

### select objects with property
`[prop=]` == `{prop: 1}` or `{prop: 'a'}` or `{prop: null`
`["string attr name"=]` for quoted property name

### select values
`[="name"]` == `'name'`
`[=13]` == `13`

### multiple conditions
`[prop=name][date=]` == `{prop: 'name', date: 'anything'}`

### Compilation of [*] pathes to JSON-Pointer
When source document is bundled we check patch operations if they contain our `[*]` in **path** and corresponding object in source is array, then we replace operation with equal operations with JSON-Pointer pathes.

### Example
```
const { compilePatchOps } = require('./index')

compilePatchOps(
    {arr: [{a: 1}, {c: 2}, {c: {$ref: '#/d'}}, {d: 4}]}, 
    [{op: 'replace', path: '/arr/[c=]', value: 2}]
);
[ { op: 'replace', path: '/arr/1', value: 2 },
  { op: 'replace', path: '/arr/2', value: 2 } ]
>
```

## Notes 
If `options.inherit` is set to **$patch** document syntax complies to [ajv-merge-patch](https://github.com/epoberezkin/ajv-merge-patch)

