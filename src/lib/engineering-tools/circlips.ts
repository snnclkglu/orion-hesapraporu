export interface CirclipRow { nominalMm: number; thicknessMm: number; freeDiameterMm: number; grooveDiameterMm: number; grooveWidthMm: number; radialDepthMm: number; shoulderMm: number; }

export const EXTERNAL_CIRCLIPS: readonly CirclipRow[] = [
  [19,1.2,17.5,18,1.3,.5,1.5],[20,1.2,18.5,19,1.3,.5,1.5],[22,1.2,20.5,21,1.3,.5,1.5],[25,1.2,23.2,23.9,1.3,.55,1.7],[28,1.5,25.9,26.6,1.6,.7,2.1],[30,1.5,27.9,28.6,1.6,.7,2.1],[32,1.5,29.6,30.3,1.6,.85,2.6],[35,1.5,32.2,33,1.6,1,3],[40,1.75,36.5,37.5,1.85,1.25,3.8],[45,1.75,41.5,42.5,1.85,1.25,3.8],[50,2,45.8,47,2.15,1.5,4.5],[55,2,50.8,52,2.15,1.5,4.5],[90,3,84.5,86.5,3.15,1.75,5.3],[95,3,89.5,91.5,3.15,1.75,5.3],[100,3,94.5,96.5,3.15,1.75,5.3],
].map(([nominalMm,thicknessMm,freeDiameterMm,grooveDiameterMm,grooveWidthMm,radialDepthMm,shoulderMm])=>({nominalMm,thicknessMm,freeDiameterMm,grooveDiameterMm,grooveWidthMm,radialDepthMm,shoulderMm}));

export const INTERNAL_CIRCLIPS: readonly CirclipRow[] = [
  [8,.8,8.7,8.4,.9,.2,.6],[10,1,10.8,10.4,1.1,.2,.6],[12,1,13,12.5,1.1,.25,.8],[15,1,16.2,15.7,1.1,.35,1.1],[16,1,17.3,16.8,1.1,.4,1.2],[18,1,19.5,19,1.1,.5,1.5],[20,1,21.5,21,1.1,.5,1.5],[22,1,23.5,23,1.1,.5,1.5],[25,1.2,26.9,26.2,1.3,.6,1.8],[28,1.2,30.1,29.4,1.3,.7,2.1],[30,1.2,32.1,31.4,1.3,.7,2.1],[32,1.5,34.4,33.7,1.3,.85,2.6],[35,1.5,37.8,37,1.6,1,3],[40,1.75,43.5,42.5,1.85,1.25,3.8],[45,1.75,48.5,47.5,1.85,1.25,3.8],[50,2,54.2,53,2.15,1.5,4.5],[60,2,64.2,63,2.15,1.5,4.5],[70,2.5,74.5,73,2.65,1.5,4.5],[80,2.5,85.5,83.5,2.65,1.75,5.3],[90,3,95.5,93.5,3.15,1.75,5.3],[100,3,105.5,103.5,3.15,1.75,5.3],
].map(([nominalMm,thicknessMm,freeDiameterMm,grooveDiameterMm,grooveWidthMm,radialDepthMm,shoulderMm])=>({nominalMm,thicknessMm,freeDiameterMm,grooveDiameterMm,grooveWidthMm,radialDepthMm,shoulderMm}));
