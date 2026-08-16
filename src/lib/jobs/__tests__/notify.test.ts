// Bildirim fan-out sözleşmesi — kim alır, kim almaz.

import { describe, expect, it } from "vitest";
import { notifyTargets } from "../notify";

describe("notifyTargets", () => {
  it("görev ataması yalnız atanana gider", () => {
    expect(
      notifyTargets({ kind: "gorev_atandi", actorId: "ben", assigneeId: "o" })
    ).toEqual(["o"]);
  });

  it("kendine atama bildirim üretmez", () => {
    expect(
      notifyTargets({ kind: "gorev_atandi", actorId: "ben", assigneeId: "ben" })
    ).toEqual([]);
  });

  it("anma yazan hariç bütün anılanlara gider", () => {
    expect(
      notifyTargets({
        kind: "bahsedildi",
        actorId: "ben",
        mentionIds: ["a", "ben", "b"],
      }).sort()
    ).toEqual(["a", "b"]);
  });

  it("durum değişikliği favori ∪ açık görev sahiplerine, aktör hariç ve tekil", () => {
    expect(
      notifyTargets({
        kind: "durum_degisti",
        actorId: "ben",
        favoriteUserIds: ["a", "b"],
        openTaskAssigneeIds: ["b", null, "c", "ben"],
      }).sort()
    ).toEqual(["a", "b", "c"]);
  });

  it("hedef yoksa boş liste — sıfır satır yazılır, uydurma bildirim yok", () => {
    expect(
      notifyTargets({ kind: "durum_degisti", actorId: "ben" })
    ).toEqual([]);
  });
});
