import $RefParser from "@apidevtools/json-schema-ref-parser"
import fs from 'fs'
import path from 'path'
import { dirname } from 'path'  // Changed this line
import yaml from 'js-yaml'

// Lot of weird variable names, following the spec - https://learn.openapis.org/specification/

const writeYaml = async (path, contents) => {
    try {
        await fs.promises.mkdir(dirname(path), { recursive: true });
        await fs.promises.writeFile(
            path,
            yaml.dump(
                contents,
                {
                    lineWidth: -1,
                }
            ));
      } catch (error) {
        throw error;
      }
}

const intersect = (a, b) => {
    var setB = new Set(b);
    return [...new Set(a)].filter(x => setB.has(x));
}

const pathItemMethodKeys = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] // https://spec.openapis.org/oas/v3.1.0#path-item-object

const removeUntaggedMethodsFromPathItem = (pathItem, targetTags) => {
    const PathItemKeys = Object.keys(pathItemObject)
    const PathItemKeysNoUntaggedMethodKeys = PathItemKeys.filter(k=>{
        const isMethodKey = pathItemMethodKeys.includes(k)
        const noTargetTag = !intersect(pathItem[k].tags ?? [], targetTags).length
        return !(isMethodKey && noTargetTag)
    })
    const strippedPathItem = {}
    for (k of PathItemKeysNoUntaggedMethodKeys) {
        strippedPathItem[k] = pathItem[k]
    }
    // If none of the methods had tags, don't return any of the other fields
    return (intersect(PathItemKeysNoUntaggedMethodKeys, pathItemMethodKeys).length) ? strippedPathItem : {}
}

const timestamp = Date.now().toString()
// const timestamp = 'hardcoded' // TODO: remove
const originalFile = path.join('testfiles', 'original', 'petstore-tag-grouped.yaml')
const unbundledDir = path.join('testfiles', 'unbundled', timestamp)
const rebundledDir = path.join('testfiles', 'rebundled', timestamp)
// Unbundling
// -----------------------
const originalSchema = await $RefParser.bundle(originalFile); // In case URL/other refs
let schemaToSplit = structuredClone(originalSchema)
// pull out shared components
const components = {components: schemaToSplit.components}
const componentsFile = path.join(unbundledDir, 'components.yaml')
schemaToSplit.components = {'$ref': `./components.yaml#/components`}
// await writeYaml(componentsFile, components)
// TODO: Split out files by tag group
for (const tagGroup of schemaToSplit['x-tagGroups']) {
    const groupedSchema = structuredClone(schemaToSplit)
    groupedSchema.info.title = tagGroup.name // Naming the spec
    groupedSchema.paths = groupedSchema.paths.map(p=>removeUntaggedMethodsFromPathItem(p)).filter(p=>Object.keys(p).length)
    // TODO: parallel promises
    const tagGroupFile = s.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    await writeYaml(path.join(unbundledDir, `${tagGroupFile}-openapi.yaml`), schemaToSplit)
}

// // Rebundling
// const rebundledSchema = await $RefParser.bundle(path.join(unbundledDir, `${fileName}.yaml`));
// console.log(rebundledSchema);
// await writeFile( // TODO: uncomment
//     path.join(rebundledDir, `${fileName}.yaml`), 
//     yaml.dump(
//         schema,
//         {
//             lineWidth: -1
//         }
//     ))
