import type { NextConfig } from 'next';

// Native / WASM packages are loaded from node_modules at runtime instead of
// being bundled, and the model + grammar files are traced into every API
// function. Binaries for other platforms are excluded to keep functions small.
const apiRoutes = '/api/**/*';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node', '@vscode/tree-sitter-wasm', 'sharp'],
  outputFileTracingIncludes: {
    [apiRoutes]: [
      './models/**/*',
      './node_modules/@vscode/tree-sitter-wasm/wasm/**/*',
      // libonnxruntime.so is dlopen'ed by the native binding, so tracing can't see it.
      './node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**/*',
    ],
  },
  outputFileTracingExcludes: {
    [apiRoutes]: [
      './node_modules/onnxruntime-node/bin/napi-v3/darwin/**',
      './node_modules/onnxruntime-node/bin/napi-v3/win32/**',
      './node_modules/onnxruntime-node/bin/napi-v3/linux/arm64/**',
      './node_modules/onnxruntime-web/**',
      './node_modules/@img/sharp-*darwin*/**',
      './node_modules/@img/sharp-*win32*/**',
    ],
  },
};

export default nextConfig;
