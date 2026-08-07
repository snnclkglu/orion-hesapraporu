import { describe, expect, it } from "vitest";
import { festoonSchematicMetrics } from "@/components/festoon-schematic";

describe("festoon şema ölçüleri", () => {
  it("hareket mesafesi ve taşıyıcı adedinden ortalama aralığı üretir", () => {
    const metrics = festoonSchematicMetrics(24, 5, 2.2);

    expect(metrics.travelDistanceM).toBe(24);
    expect(metrics.trolleyCount).toBe(5);
    expect(metrics.averagePitchM).toBe(4);
    expect(metrics.loopHeightM).toBe(2.2);
  });

  it("çok sayıda taşıyıcıda görünümü sınırlayıp gerçek adedi korur", () => {
    const metrics = festoonSchematicMetrics(60, 12, undefined);

    expect(metrics.trolleyCount).toBe(12);
    expect(metrics.drawnTrolleyCount).toBe(8);
    expect(metrics.loopHeightM).toBe(1.5);
  });
});
