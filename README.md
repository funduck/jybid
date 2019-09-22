# JYBID
**j**son **y**aml **b**undle **i**nherit **d**ereference ***

This lib allows to bundle/dereference `json` and `yaml` documents and extend a document with [JSON-Patch](http://jsonpatch.com/)

## Purpose
I was making some API docs in [OpenAPI](https://www.openapis.org/) format and met troubles:
1. one doc for whole API is too big
2. docs sometimes extend one another: add some keys, remove some keys, change some values. For example, when API version changed I added some URL request parameters, renamed some parameters, and removed others
3. when I have several versions of API, how to get a list of changes? It would be so great to get it from OpenAPI docs in form of [JSON-Patch](http://jsonpatch.com/) and visualize [somehow](https://github.com/benjamine/jsondiffpatch)

So I wanted to:
1. Use `json` and `yaml` config files simultaneously
2. Split big files into pieces being able to glue them back on reading
3. Have some inheritance technique for files (single and splitted) that allows me to describe changes and get a resulting document

Needs 1 and 2 are solved by [json-schema-ref-parser](https://github.com/APIDevTools/json-schema-ref-parser)  
Need 3 could be solved by something like [ajv-merge-patch](https://github.com/epoberezkin/ajv-merge-patch)  
But all together it didn't work out of box, so I made a little patch to [json-schema-ref-parser](https://github.com/APIDevTools/json-schema-ref-parser) and added JSON-Patch compiler.   
And extended JSON-Pointer selector for array elements.

## Example
We have weather forecast database for Russia and Finland and we supposed that cities in these countries always have different names so we dont need to specify country in request. Of course it is wrong idea, but just for example..  
```
openapi: 3.0.1
info:
  title: Readonly API for weather forecast
  description: >-
    Multiline
    description of service.
  version: 1.0.0
servers:
  - url: 'https://weather.forecast/v1'
paths:
  /city:
    get:
      summary: Get forecast for city by it name
      operationId: getForecastInCity
      parameters:
        - name: names
          in: query
          description: Latin city names
          required: true
          schema:
            type: array
            items:
              type: string
              default: Moscow
      responses:
        '200':
          description: successful operation
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Forecast'
        '400':
          description: any error
          content: {}
components:
  schemas:
    Forecast:
      $ref: ./forecast.json
```
Next month we add forecasts for Belarus and we have troubles now: for example a town named 'Kamenka' exists in Russia and in Belarus  
But we cant add parameter to v1 because some good people use our API in android app and it works ok in Russia and in Finland, and if we set 'default' country many requests will fail. Well, we could make some workarounds but.. it is just better to make correct next version of API.  
So we need to replace unclear parameter 'names' with 'cities' and add 'country', this is how we could do it with [jybid](#jybid)  
```
$inherit:
  source:
    $ref: ./api.v1.yaml
  with:
    - op: 'replace'
      path: '/info/version'
      value: 2.0.0
    - op: 'replace'
      path: '/servers/0/url'
      value: 'https://weather.forecast/v2'
    - op: 'remove'
      path: '/paths/~1city/get/parameters/[name=names]'
    - op: 'add'
      path: '/paths/~1city/get/parameters/-'
      value:
        name: cities
        in: query
        description: Latin city names
        required: true
        schema:
          type: array
          items:
            type: string
            default: Moscow
    - op: 'add'
      path: '/paths/~1city/get/parameters/-'
      value:
        name: country
        in: query
        description: Latin country name
        required: true
        schema:
          type: string
          default: Russia

```

Referencing, bundling and inheritance is in keywords

    $inherit, source, with

Array selector is in line

    path: '/paths/~1city/get/parameters/[name=names]'

## Methods: Bundle & Dereference
To bundle file's references   
**bundle(filepath, options) returns Promise**  

To bundle and eliminate internal references  
**dereference(filepath, options) returns Promise**  

For both
1. if `options.inherit==true` then json-patches will be compiled  
2. if `options.inherit` is a string then it will set a keyword instead of `"$inherit"` and if it is `"$patch"` then document syntax complies to [ajv-merge-patch](https://github.com/epoberezkin/ajv-merge-patch)

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

## Selectors
In [JSON-Patch](http://jsonpatch.com/) **path** must be a [JSON-Pointer](https://tools.ietf.org/html/rfc6901), but referencing array elements does not look good: `path: '/2'`. Which element do we remove here? You never know until you see **object**
```
object = [1,2,234]
patch = [{op: 'remove', path: '/2'}]
```
We can make **path** look better if we select element by its properties or value instead of index in array, so we'd like to replace numbers with **selectors**, like in jquery
```
// patch with "selector" in path
patch = [{op: 'remove', path: '/[=234]'}]

// compiling patch
compilePatchOps(object, patch)

// patch with JSON-Pointer path
[{op: 'remove', path: '/2'}]
```

Note that inside selector **[\*]** quotation is used:
* `\"` is `"`
* `\\` is `\`
* `/` is `/`
* `~` is `~`, not `~1` and `~0` like in [JSON-Pointer](https://tools.ietf.org/html/rfc6901)

so, selectors are:

### by property=value pairs
Value is treated as string if possible and as number if it can't be string
* `[prop=value]` == `{prop: 'value'}`  
* `[prop="13"]` == `{prop: '13'}`  
* `[prop=42]` == `{prop: 42}`  
* `["string attr name"=name]` == `{'string attr name': 'name'}` To reference compicated property name use double quotes  

### with property
* `[prop=]` == `{prop: 1}` or `{prop: 'a'}` or `{prop: null}`  
* `["string attr name"=]` for quoted property name  
* `[prop=null]` == `{prop: null}`
* `[prop="null"]` == `{prop: "null"}`

### with value
* `[="name"]` == `'name'`
* `[=13]` == `13`

### multiple conditions
It works like AND  
`[prop=name][date=]` == `{prop: 'name', date: 'anything'}`

## Method: compilePatchOps
To compile [JSON-Patch](http://jsonpatch.com/) with [selectors](#selectors) in pathes to [JSON-Patch](http://jsonpatch.com/) with [JSON-Pointer](https://tools.ietf.org/html/rfc6901) pathes  
**compilePatchOps(source, patch) returns Array**  

When source document is bundled we check every patch operation:
1. if it contains selector in **path**
2. corresponding object in **source** is array  

then we replace it with equal operation with [JSON-Pointer](https://tools.ietf.org/html/rfc6901) path, for example:

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

## Thanks
[json-schema-ref-parser](https://github.com/APIDevTools/json-schema-ref-parser)  
[rfc6902](https://github.com/chbrown/rfc6902)  
[json-ptr](https://github.com/flitbit/json-ptr)
