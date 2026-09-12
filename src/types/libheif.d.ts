declare module "libheif-js/wasm-bundle" {
  interface DecodedImage {
    get_width(): number;
    get_height(): number;
    display(target: { data: Uint8ClampedArray; width: number; height: number }, callback: (result: { data: Uint8ClampedArray } | null) => void): void;
    free(): void;
  }
  const libheif: { HeifDecoder: new () => { decode(bytes: Uint8Array): DecodedImage[] } };
  export default libheif;
}
declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  import libheif from "libheif-js/wasm-bundle";
  const createHeif: () => typeof libheif | Promise<typeof libheif>;
  export default createHeif;
}
