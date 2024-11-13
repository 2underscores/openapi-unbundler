const { bundle } = require('@redocly/cli');

async function bundleSpec(params) {
    try {
        const result = await bundle({
          ref: './path/to/your/spec.yaml', // Entry point
          output: './bundled-spec.yaml',    // Output file
          // Other options:
          // dereferenced: true,           // Fully dereference all $refs
          // format: 'json',               // Output format
          // lint: true,                   // Run linting
        });
        console.log('Bundle success:', result);
      } catch (error) {
        console.error('Bundle failed:', error);
      }
}

async function wrapBundler(filename) {
    return await bundleSpec({
        ref: `./testfiles/unbundled/${filename}.yaml`,
        output: `./testfiles/rebundled/${filename}.yaml`,
    })
}

wrapBundler('petstoreSplitPet')