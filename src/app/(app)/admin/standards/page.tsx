// Standart tablolar (salt-okunur): FEM/DIN katsayı tabloları.
// Hesap motoru bu değerlerin kod içindeki kopyasını kullanır (src/lib/calc);
// DB tabloları referans/görünürlük içindir.

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

function num(v: number | null): string {
  return v == null ? "—" : String(v);
}

export default async function AdminStandardsPage() {
  const supabase = await createClient();

  const [ropeSafety, drumSheave, mechLife, shaftMaterials] = await Promise.all([
    supabase.from("cat_rope_safety").select("mech_class, zp_moving, zp_fixed").order("mech_class"),
    supabase
      .from("cat_drum_sheave_coeff")
      .select("mech_class, drum_h, sheave_h, equalizer_h")
      .order("mech_class"),
    supabase.from("cat_mechanism_life").select("usage_class, hours_min, hours_max").order("usage_class"),
    supabase.from("cat_shaft_materials").select("material, bending, shear, combined"),
  ]);

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Standart Tablolar</h2>
        <p className="text-sm text-muted-foreground">
          Bu tablolar FEM/DIN standart değerleridir; hesap motoru bu değerlerin kod içindeki
          kopyasını kullanır — değişiklik kod güncellemesi gerektirir.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Halat Emniyet Katsayıları (Zp)</CardTitle>
            <CardDescription>FEM — mekanizma sınıfına göre minimum Zp</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sınıf</TableHead>
                  <TableHead className="text-right">Hareketli halat</TableHead>
                  <TableHead className="text-right">Sabit halat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ropeSafety.data ?? []).map((r) => (
                  <TableRow key={r.mech_class}>
                    <TableCell className="font-mono">{r.mech_class}</TableCell>
                    <TableCell className="text-right font-mono">{num(r.zp_moving)}</TableCell>
                    <TableCell className="text-right font-mono">{num(r.zp_fixed)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tambur / Makara H Katsayıları</CardTitle>
            <CardDescription>FEM — mekanizma sınıfına göre D/d katsayıları</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sınıf</TableHead>
                  <TableHead className="text-right">Tambur</TableHead>
                  <TableHead className="text-right">Makara</TableHead>
                  <TableHead className="text-right">Denge makarası</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drumSheave.data ?? []).map((r) => (
                  <TableRow key={r.mech_class}>
                    <TableCell className="font-mono">{r.mech_class}</TableCell>
                    <TableCell className="text-right font-mono">{num(r.drum_h)}</TableCell>
                    <TableCell className="text-right font-mono">{num(r.sheave_h)}</TableCell>
                    <TableCell className="text-right font-mono">{num(r.equalizer_h)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mekanizma Ömür Bantları</CardTitle>
            <CardDescription>Kullanım sınıfı (T) — gerekli rulman ömrü [saat]</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sınıf</TableHead>
                  <TableHead className="text-right">Alt sınır</TableHead>
                  <TableHead className="text-right">Üst sınır</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(mechLife.data ?? []).map((r) => (
                  <TableRow key={r.usage_class}>
                    <TableCell className="font-mono">{r.usage_class}</TableCell>
                    <TableCell className="text-right font-mono">{num(r.hours_min)}</TableCell>
                    <TableCell className="text-right font-mono">{num(r.hours_max)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mil Malzemeleri</CardTitle>
            <CardDescription>İzin verilen gerilmeler [kg/cm²]</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Malzeme</TableHead>
                  <TableHead className="text-right">Eğilme</TableHead>
                  <TableHead className="text-right">Kayma</TableHead>
                  <TableHead className="text-right">Bileşik</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(shaftMaterials.data ?? []).map((r) => (
                  <TableRow key={r.material}>
                    <TableCell className="font-mono">{r.material}</TableCell>
                    <TableCell className="text-right font-mono">{num(r.bending)}</TableCell>
                    <TableCell className="text-right font-mono">{num(r.shear)}</TableCell>
                    <TableCell className="text-right font-mono">{num(r.combined)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
