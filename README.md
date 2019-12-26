# JYBID
**j**son **y**aml **b**undle **i**nherit **d**ereference ***

This lib allows to bundle/dereference `json` and `yaml` documents and extend a document with [JSON-Patch](http://jsonpatch.com/)

## Purpose
When I was writing some API docs in [OpenAPI](https://www.openapis.org/) format I found some troubles:
1. one doc for whole API is too big
2. docs sometimes logically extend one another.
3. when I have several API versions, how to get a list of changes between them? It would be great to have it in form of [JSON-Patch](http://jsonpatch.com/) and visualize [somehow](https://github.com/benjamine/jsondiffpatch)

So I wanted to:
1. Use `json` and `yaml` config files simultaneously, being able to split big files into several smaller
2. Have some inheritance technique

First part is fairly easy, it can be solved by [json-schema-ref-parser](https://github.com/APIDevTools/json-schema-ref-parser)  
Second part also has a solution like [ajv-merge-patch](https://github.com/epoberezkin/ajv-merge-patch)  
But all together it doesn't work out of box, so I made a little patch to [json-schema-ref-parser](https://github.com/APIDevTools/json-schema-ref-parser) that enables inheritance based on JSON-Patch syntax.
Also I extended JSON-Pointer in case when we point to something in array and it is called [array selector](#selectors).

## Example of how can JYBID be used
Suppose we have a weather forecast database and want to build a readonly service for it. We have data only for Russia and Finland and we supposed that cities in these countries always have different names so we dont need to specify country in request to our service. Of course this is not the best idea, but just for example..  
So, we have a sevice API  

```
openapi: 3.0.1
info:
  title: Readonly API for weather forecast service
  description: >-
    Multiline
    description of service.
  version: 1.0.0
servers:
  - url: 'https://weather.forecast/v1'
paths:
  /city:
    get:
      summary: Get forecast for city by name
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

Next month we add forecasts for Belarus and we have troubles now: for example a town named 'Kamenka' exists in Russia and in Belarus.  
Of course we need to add parameter `country` but we can't add it to v1 because some people already use our API in their app and it works ok in Russia and in Finland. If we add `country` with some default value many requests will fail. Well, we could make some workarounds based on city name being checked against list of all cities in our 3 countries but.. it is just better to make next version of API correct and ask our clients to use it instead of incorrect v1.  
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
To bundle a file
**bundle(filepath, options) returns Promise**  

To bundle a file and resolve even internal references  
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
In [JSON-Patch](http://jsonpatch.com/) **path** must be a [JSON-Pointer](https://tools.ietf.org/html/rfc6901), but referencing array elements does not look good: `path: '/2'`. At what element do we point? You never know until you see **object** for which we apply the patch  
```
object = [1,2,234]
patch = [{op: 'remove', path: '/2'}]
```
So, we could make **path** look better if we select element by its properties or value instead of index in array, so we'd like to replace numbers with **selectors**, like in jquery
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
* `[prop=value] == {prop: 'value'}`  
* `[prop="13"] == {prop: '13'}`  
* `[prop=42] == {prop: 42}`  
* `["string attr name"=name] == {'string attr name': 'name'}` To reference compicated property name use double quotes  

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
