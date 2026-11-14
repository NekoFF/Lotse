import { describe, expect, it } from "vitest";
import { alsOrt, sichereEmail } from "./orte";

describe("Kontaktdaten aus OSM", () => {
  it("E-Mail nur, wenn sie wie eine Adresse aussieht", () => {
    expect(sichereEmail("info@zahnaerzte-amdom.de")).toBe("info@zahnaerzte-amdom.de");
    expect(sichereEmail("a@b.de; c@d.de")).toBe("a@b.de");
    expect(sichereEmail("keine mail")).toBeNull();
    expect(sichereEmail("<script>@x.de")).toBeNull();
  });
  it("Website, Telefon und E-Mail werden übernommen", () => {
    const o = alsOrt({ osm_type: "node", osm_id: 1, lat: "50.55", lon: "8.5", name: "Zahnärzte am Dom", display_name: "", type: "dentist",
      extratags: { website: "https://www.zahnaerzte-amdom.de/", phone: "+49 6441 94 60 46", email: "info@zahnaerzte-amdom.de" } });
    expect(o.website).toBe("https://www.zahnaerzte-amdom.de/");
    expect(o.telefon).toBe("+49 6441 94 60 46");
    expect(o.email).toBe("info@zahnaerzte-amdom.de");
  });
});
