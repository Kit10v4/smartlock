declare module "gifuct-js" {
  export function parseGIF(buffer: ArrayBuffer): unknown;
  export function decompressFrames(
    gif: unknown,
    buildImagePatches: boolean
  ): Array<{
    delay: number;
    patch: number[];
    dims: { width: number; height: number; left: number; top: number };
  }>;
}
