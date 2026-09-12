import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { inspectWebp } from "./webp";
describe("Yükleme geçidi görsel sınırı", () => {
  it.each([3,4] as const)("%i kanallı yeniden kodlanmış görseli kabul eder",async channels=>{
    const bytes=await sharp({create:{width:64,height:64,channels,background:{r:120,g:60,b:30,alpha:0.4}}}).webp().toBuffer();
    expect(inspectWebp(bytes,256)).toEqual({width:64,height:64});
  });
  it("EXIF içeren ve yanlış boyutlu görseli reddeder",async()=>{
    const image=sharp({create:{width:300,height:300,channels:3,background:'red'}});
    expect(()=>inspectWebp(new Uint8Array([1,2,3]),256)).toThrow();
    const large=await image.clone().webp().toBuffer();
    expect(()=>inspectWebp(large,256)).toThrow();
    const exif=await image.clone().withMetadata().webp().toBuffer();
    expect(()=>inspectWebp(exif,1800)).toThrow();
    const corrupt=Buffer.from(large);corrupt.writeUInt32LE(1,4);
    expect(()=>inspectWebp(corrupt,1800)).toThrow();
  });
});
