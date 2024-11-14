import $RefParser from "@apidevtools/json-schema-ref-parser"
import fs from 'fs'
import path from 'path'
import { dirname } from 'path'  // Changed this line
import yaml from 'js-yaml'

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

const timestamp = Date.now().toString()
// const timestamp = 'hardcoded' // TODO: remove
const originalFile = path.join('testfiles', 'original', 'petstore-tag-grouped.yaml')
const unbundledDir = path.join('testfiles', 'unbundled', timestamp)
const rebundledDir = path.join('testfiles', 'rebundled', timestamp)
const fileName = 'petstoreSplitRest'
// Unbundling
const originalSchema = await $RefParser.bundle(originalFile); // In case URL/other refs
let schemaToSplit = structuredClone(originalSchema)
// TODO: pull out shared components
const components = {components: schemaToSplit.components}
const componentsFile = path.join(unbundledDir, 'components.yaml')
schemaToSplit.components = {'$ref': `./components.yaml#/components`}
await writeYaml(componentsFile, components)
await writeYaml(path.join(unbundledDir, 'unsplitAPI.yaml'), schemaToSplit)

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
