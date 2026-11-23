const ts = require('typescript');

module.exports = {
  process(sourceText, sourcePath) {
    const result = ts.transpileModule(sourceText, {
      fileName: sourcePath,
      compilerOptions: {
        allowSyntheticDefaultImports: true,
        emitDecoratorMetadata: true,
        esModuleInterop: true,
        experimentalDecorators: true,
        inlineSourceMap: true,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        target: ts.ScriptTarget.ES2023,
      },
    });

    return { code: result.outputText };
  },
};
